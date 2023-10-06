use std::{
    env,
    sync::Arc,
    time::Duration,
};

use async_rustls::rustls::ClientConfig;
use bytes::Bytes;
use lazy_static::lazy_static;
use napi::{
    bindgen_prelude::*,
    threadsafe_function::{
        ErrorStrategy,
        ThreadSafeCallContext,
        ThreadsafeFunction,
        ThreadsafeFunctionCallMode,
    },
};
use napi_derive::napi;
use ngrok::{
    session::{
        default_connect,
        ConnectError,
        SessionBuilder as NgrokSessionBuilder,
        Update,
    },
    tunnel::AcceptError,
    Session as NgrokSession,
};
use parking_lot::Mutex as SyncMutex;
use tokio::sync::Mutex;
use tracing::{
    debug,
    info,
};

use crate::{
    listener::{
        remove_global_listener,
        search_listeners,
        Listener,
    },
    listener_builder::{
        HttpListenerBuilder,
        LabeledListenerBuilder,
        TcpListenerBuilder,
        TlsListenerBuilder,
    },
    napi_err,
    napi_ngrok_err,
};

const CLIENT_TYPE: &str = "ngrok-nodejs";
const VERSION: &str = env!("CARGO_PKG_VERSION");

// appease clippy
type TsfnOption = Option<Arc<Mutex<ThreadsafeFunction<Vec<String>, ErrorStrategy::Fatal>>>>;

lazy_static! {
    // Allow user to store a default auth token to use for all sessions
    static ref AUTH_TOKEN: Mutex<Option<String>> = Mutex::new(None);
}

/// Set the default auth token to use for any future sessions.
#[napi]
#[allow(dead_code)]
pub async fn authtoken(authtoken: String) {
    let mut token = AUTH_TOKEN.lock().await;
    token.replace(authtoken);
}

/// The builder for an ngrok session.
///
/// @group Listener and Sessions
#[napi]
#[allow(dead_code)]
#[derive(Default)]
pub(crate) struct SessionBuilder {
    raw_builder: Arc<SyncMutex<NgrokSessionBuilder>>,
    connect_handler: TsfnOption,
    disconnect_handler: TsfnOption,
    auth_token_set: bool,
}

#[napi]
#[cfg_attr(feature = "cargo-clippy", allow(clippy::new_without_default))]
#[allow(dead_code)]
impl SessionBuilder {
    /// Create a new session builder
    #[napi(constructor)]
    pub fn new() -> Self {
        SessionBuilder {
            raw_builder: Arc::new(SyncMutex::new(
                NgrokSession::builder()
                    .client_info(CLIENT_TYPE, VERSION, None::<String>)
                    .clone(),
            )),
            ..Default::default()
        }
    }

    /// Configures the session to authenticate with the provided authtoken. You
    /// can [find your existing authtoken] or [create a new one] in the ngrok
    /// dashboard.
    ///
    /// See the [authtoken parameter in the ngrok docs] for additional details.
    ///
    /// [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
    /// [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
    /// [authtoken parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#authtoken
    #[napi]
    pub fn authtoken(&mut self, authtoken: String) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.authtoken(authtoken);
        self.auth_token_set = true;
        self
    }

    /// Shortcut for calling [SessionBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi]
    pub fn authtoken_from_env(&mut self) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.authtoken_from_env();
        if let Ok(token) = env::var("NGROK_AUTHTOKEN") {
            if !token.is_empty() {
                self.auth_token_set = true;
            }
        }
        self
    }

    /// Add client type and version information for a client application.
    ///
    /// This is a way for applications and library consumers of this crate
    /// identify themselves.
    ///
    /// This will add a new entry to the `User-Agent` field in the "most significant"
    /// (first) position. Comments must follow [RFC 7230] or a connection error may occur.
    ///
    /// [RFC 7230]: https://datatracker.ietf.org/doc/html/rfc7230#section-3.2.6
    #[napi]
    pub fn client_info(
        &mut self,
        client_type: String,
        version: String,
        comments: Option<String>,
    ) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.client_info(client_type, version, comments);
        self
    }

    /// Configures how often the session will send heartbeat messages to the ngrok
    /// service to check session liveness.
    ///
    /// See the [heartbeat_interval parameter in the ngrok docs] for additional
    /// details.
    ///
    /// [heartbeat_interval parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#heartbeat_interval
    #[napi]
    pub fn heartbeat_interval(&mut self, heartbeat_interval: u32) -> Result<&Self> {
        let mut builder = self.raw_builder.lock();
        builder
            .heartbeat_interval(Duration::new(heartbeat_interval.into(), 0))
            .map_err(|e| napi_err(format!("{e}")))?;
        Ok(self)
    }

    /// Configures the duration to wait for a response to a heartbeat before
    /// assuming the session connection is dead and attempting to reconnect.
    ///
    /// See the [heartbeat_tolerance parameter in the ngrok docs] for additional
    /// details.
    ///
    /// [heartbeat_tolerance parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#heartbeat_tolerance
    #[napi]
    pub fn heartbeat_tolerance(&mut self, heartbeat_tolerance: u32) -> Result<&Self> {
        let mut builder = self.raw_builder.lock();
        builder
            .heartbeat_tolerance(Duration::new(heartbeat_tolerance.into(), 0))
            .map_err(|e| napi_err(format!("{e}")))?;
        Ok(self)
    }

    /// Configures the opaque, machine-readable metadata string for this session.
    /// Metadata is made available to you in the ngrok dashboard and the Agents API
    /// resource. It is a useful way to allow you to uniquely identify sessions. We
    /// suggest encoding the value in a structured format like JSON.
    ///
    /// See the [metdata parameter in the ngrok docs] for additional details.
    ///
    /// [metdata parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#metadata
    #[napi]
    pub fn metadata(&mut self, metadata: String) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.metadata(metadata);
        self
    }

    /// Configures the network address to dial to connect to the ngrok service.
    /// Use this option only if you are connecting to a custom agent ingress.
    ///
    /// See the [server_addr parameter in the ngrok docs] for additional details.
    ///
    /// [server_addr parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#server_addr
    #[napi]
    pub fn server_addr(&mut self, addr: String) -> Result<&Self> {
        let mut builder = self.raw_builder.lock();
        builder
            .server_addr(addr)
            .map_err(|e| napi_err(format!("{e}")))?;
        Ok(self)
    }

    /// Configures the TLS certificate used to connect to the ngrok service while
    /// establishing the session. Use this option only if you are connecting through
    /// a man-in-the-middle or deep packet inspection proxy. Pass in the bytes of the certificate
    /// to be used to validate the connection, then override the address to connect to via
    /// the server_addr call.
    ///
    /// Roughly corresponds to the [root_cas parameter in the ngrok docs].
    ///
    /// [root_cas parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#root_cas
    #[napi]
    pub fn ca_cert(&mut self, cert_bytes: Uint8Array) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.ca_cert(Bytes::from(cert_bytes.to_vec()));
        self
    }

    /// Configures a function which is called to after a disconnection to the
    /// ngrok service. In the event of network disruptions, it will be called each time
    /// the session reconnects. The handler is given the address that will be used to
    /// connect the session to, e.g. "example.com:443", and the message from the error
    /// that occurred. Returning true from the handler will cause the session to
    /// reconnect, returning false will cause the Session to throw an uncaught error.
    #[napi(ts_args_type = "handler: (addr: string, error: string) => boolean")]
    pub fn handle_disconnection(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);
        self.disconnect_handler = Some(tsfn);
        self.update_connector()
    }

    pub fn handle_connection(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);
        self.connect_handler = Some(tsfn);
        self.update_connector()
    }

    /// Update the connector callback in the upstream rust sdk.
    fn update_connector(&mut self) -> &Self {
        // register connect handler. this needs the return value, so cannot use call_tsfn().
        let mut builder = self.raw_builder.lock();
        // clone for move to connector function
        let connect_handler = self.connect_handler.clone();
        let disconnect_handler = self.disconnect_handler.clone();
        builder.connector(
            move |host: String,
                  port: u16,
                  tls_config: Arc<ClientConfig>,
                  err: Option<AcceptError>| {
                // clone for async move out of environment
                let conn_tsfn = connect_handler.clone();
                let disconn_tsfn = disconnect_handler.clone();
                async move {
                    // call disconnect javascript handler
                    if let Some(handler) = disconn_tsfn {
                        if let Some(err) = err.clone() {
                            // call javascript handler
                            let resp: Option<bool> = handler
                                .clone()
                                .lock()
                                .await
                                .call_async(vec![format!("{host}:{port}"), err.to_string()])
                                .await
                                .map_err(|_e| ConnectError::Canceled)?;

                            if let Some(reconnect) = resp {
                                if !reconnect {
                                    info!("Aborting connection to {host}:{port}");
                                    println!("Aborting connection to {host}:{port}"); // still shown if this takes down the process
                                    return Err(ConnectError::Canceled);
                                }
                            }
                        };
                    }
                    // call the upstream connector
                    let res = default_connect(host, port, tls_config, err).await;

                    // call connect handler
                    if let Some(handler) = conn_tsfn {
                        let args = match &res {
                            Ok(_) => vec!["connected".to_string()],
                            Err(err) => vec!["closed".to_string(), err.to_string()],
                        };
                        // call javascript handler
                        handler
                            .clone()
                            .lock()
                            .await
                            .call_async(args)
                            .await
                            .map_err(|_e| ConnectError::Canceled)?;
                    }
                    res
                }
            },
        );
        self
    }

    /// Configures a function which is called when the ngrok service requests that
    /// this [Session] stops. Your application may choose to interpret this callback
    /// as a request to terminate the [Session] or the entire process.
    ///
    /// Errors returned by this function will be visible to the ngrok dashboard or
    /// API as the response to the Stop operation.
    ///
    /// Do not block inside this callback. It will cause the Dashboard or API
    /// stop operation to time out. Do not call [std::process::exit] inside this
    /// callback, it will also cause the operation to time out.
    #[napi(ts_args_type = "handler: () => void")]
    pub fn handle_stop_command(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);
        // register stop handler
        let mut builder = self.raw_builder.lock();
        builder.handle_stop_command(move |_req| call_tsfn(tsfn.clone(), vec![()]));
        self
    }

    /// Configures a function which is called when the ngrok service requests
    /// that this [Session] updates. Your application may choose to interpret
    /// this callback as a request to restart the [Session] or the entire
    /// process.
    ///
    /// Errors returned by this function will be visible to the ngrok dashboard or
    /// API as the response to the Restart operation.
    ///
    /// Do not block inside this callback. It will cause the Dashboard or API
    /// stop operation to time out. Do not call [std::process::exit] inside this
    /// callback, it will also cause the operation to time out.
    #[napi(ts_args_type = "handler: () => void")]
    pub fn handle_restart_command(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);
        // register restart handler
        let mut builder = self.raw_builder.lock();
        builder.handle_restart_command(move |_req| call_tsfn(tsfn.clone(), vec![()]));
        self
    }

    /// Configures a function which is called when the ngrok service requests
    /// that this [Session] updates. Your application may choose to interpret
    /// this callback as a request to update its configuration, itself, or to
    /// invoke some other application-specific behavior.
    ///
    /// Errors returned by this function will be visible to the ngrok dashboard or
    /// API as the response to the Restart operation.
    ///
    /// Do not block inside this callback. It will cause the Dashboard or API
    /// stop operation to time out. Do not call [std::process::exit] inside this
    /// callback, it will also cause the operation to time out.
    #[napi(ts_args_type = "handler: (update: UpdateRequest) => void")]
    pub fn handle_update_command(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);
        // register update handler
        let mut builder = self.raw_builder.lock();
        builder.handle_update_command(move |req: Update| {
            let update = UpdateRequest {
                version: req.version,
                permit_major_version: req.permit_major_version,
            };
            call_tsfn(tsfn.clone(), vec![update])
        });
        self
    }

    /// Call the provided handler whenever a heartbeat response is received,
    /// with the latency in milliseconds.
    ///
    /// If the handler returns an error, the heartbeat task will exit, resulting
    /// in the session eventually dying as well.
    #[napi(ts_args_type = "handler: (latency: number) => void")]
    pub fn handle_heartbeat(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);

        // register heartbeat handler
        let mut builder = self.raw_builder.lock();
        builder.handle_heartbeat(move |latency: Option<Duration>| {
            call_tsfn(
                tsfn.clone(),
                vec![latency.map(|d| u32::try_from(d.as_millis()).ok())],
            )
        });
        self
    }

    /// Attempt to establish an ngrok session using the current configuration.
    #[napi]
    pub async fn connect(&self) -> Result<Session> {
        let mut builder = self.raw_builder.lock().clone();
        // set default auth token if it exists
        let default_auth_token = AUTH_TOKEN.lock().await;
        let mut auth_token_set = self.auth_token_set;
        if default_auth_token.is_some() && !self.auth_token_set {
            builder.authtoken(default_auth_token.as_ref().unwrap());
            auth_token_set = true;
        }
        // connect to ngrok
        builder
            .connect()
            .await
            .map(|s| {
                let maybe_with = if auth_token_set { "with" } else { "without" };
                info!("Session created {:?}, {maybe_with} auth token", s.id());
                Session {
                    raw_session: Arc::new(SyncMutex::new(s)),
                }
            })
            .map_err(|e| napi_ngrok_err("failed to connect session", &e))
    }
}

/// An ngrok session.
///
/// @group Listener and Sessions
#[napi(custom_finalize)]
pub(crate) struct Session {
    #[allow(dead_code)]
    raw_session: Arc<SyncMutex<NgrokSession>>,
}

#[napi]
#[allow(dead_code)]
impl Session {
    /// Start building a listener backing an HTTP endpoint.
    #[napi]
    pub fn http_endpoint(&self) -> HttpListenerBuilder {
        let session = self.raw_session.lock().clone();
        HttpListenerBuilder::new(session.clone(), session.http_endpoint())
    }

    /// Start building a listener backing a TCP endpoint.
    #[napi]
    pub fn tcp_endpoint(&self) -> TcpListenerBuilder {
        let session = self.raw_session.lock().clone();
        TcpListenerBuilder::new(session.clone(), session.tcp_endpoint())
    }

    /// Start building a listener backing a TLS endpoint.
    #[napi]
    pub fn tls_endpoint(&self) -> TlsListenerBuilder {
        let session = self.raw_session.lock().clone();
        TlsListenerBuilder::new(session.clone(), session.tls_endpoint())
    }

    /// Start building a labeled listener.
    #[napi]
    pub fn labeled_listener(&self) -> LabeledListenerBuilder {
        let session = self.raw_session.lock().clone();
        LabeledListenerBuilder::new(session.clone(), session.labeled_tunnel())
    }

    /// Retrieve a list of this session's non-closed listeners, in no particular order.
    #[napi]
    pub async fn listeners(&self) -> Vec<Listener> {
        let session_id = self.raw_session.lock().id();
        search_listeners(Some(session_id), None).await
    }

    /// Close a listener with the given ID.
    #[napi]
    pub async fn close_listener(&self, id: String) -> Result<()> {
        let session = self.raw_session.lock().clone();
        // close listener
        let res = session
            .close_tunnel(id.clone())
            .await
            .map_err(|e| napi_ngrok_err("failed to close listener", &e));

        if res.is_ok() {
            // remove our reference to allow it to drop
            remove_global_listener(&id).await;
        }
        res
    }

    /// Close the ngrok session.
    #[napi]
    pub async fn close(&self) -> Result<()> {
        let mut session = self.raw_session.lock().clone();
        session
            .close()
            .await
            .map_err(|e| napi_ngrok_err("failed to close session", &e))
    }
}

impl ObjectFinalize for Session {
    fn finalize(self, mut _env: Env) -> Result<()> {
        debug!("Session finalize");
        Ok(())
    }
}

/// Container for UpdateRequest information.
#[derive(Clone)]
#[napi]
pub struct UpdateRequest {
    /// The version that the agent is requested to update to.
    pub version: String,
    /// Whether or not updating to the same major version is sufficient.
    pub permit_major_version: bool,
}

pub(crate) fn create_tsfn<A>(
    env: Env,
    handler: JsFunction,
) -> Arc<Mutex<ThreadsafeFunction<Vec<A>, ErrorStrategy::Fatal>>>
where
    A: ToNapiValue,
{
    Arc::new(Mutex::new({
        let mut tsfn = handler
            .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<Vec<A>>| Ok(ctx.value))
            .expect("Failed to create update callback function");
        // tell the runtime it can exit while this callback exists
        tsfn.unref(&env).expect("Failed to unref callback function");
        tsfn
    }))
}

/// Call a threadsafe function that has the given argument type and no return value.
pub(crate) async fn call_tsfn<A, E>(
    tsfn: Arc<Mutex<ThreadsafeFunction<A, ErrorStrategy::Fatal>>>,
    arg: A,
) -> core::result::Result<(), E>
where
    A: ToNapiValue,
{
    tsfn.lock()
        .await
        .call(arg, ThreadsafeFunctionCallMode::NonBlocking);
    Ok(())
}
