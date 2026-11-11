use std::{
    env,
    num::NonZeroU32,
    sync::Arc,
    time::Duration,
};

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
use rustls::ClientConfig;
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

const CLIENT_TYPE: &str = "ngrok-javascript";
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

    /// Configures how long the session waits between attempts to reconnect
    /// after it loses its connection to the ngrok service, in milliseconds.
    ///
    /// The first attempt is immediate. After it, the session waits `initialMs`,
    /// then twice as long before each attempt, up to `maxMs`. Each wait is
    /// scaled by a random factor in [0, 1) unless
    /// [SessionBuilder::reconnectJitter] turns that off. The defaults are
    /// 50 ms and 30 s. For a fixed wait between every attempt, pass the same
    /// value for both and turn jitter off.
    ///
    /// These waits never stop the session from reconnecting on their own:
    /// [SessionBuilder::reconnectMaxAttempts], or closing the session, does.
    ///
    /// A value that is not a whole number of milliseconds of at least 0 (a
    /// fraction, a negative number, NaN or Infinity) is refused with an error
    /// naming the argument. The ngrok Rust SDK then checks the range: it
    /// rejects an `initialMs` below 1 or above `maxMs`, and a `maxMs` above one
    /// day (86400000), with an error that starts with the call and its
    /// arguments, as in "reconnectBackoff(initialMs: 2000, maxMs: 1000): ",
    /// and names the rule broken. A refused call leaves the builder unchanged.
    #[napi]
    pub fn reconnect_backoff(&mut self, initial_ms: f64, max_ms: f64) -> Result<&Self> {
        let millis = |name: &str, ms: f64| {
            whole_number(ms).map(Duration::from_millis).ok_or_else(|| {
                napi_err(format!(
                    "{name} must be a whole number of milliseconds, at least 0, got {}",
                    js_number(ms)
                ))
            })
        };
        let initial = millis("initialMs", initial_ms)?;
        let max = millis("maxMs", max_ms)?;
        let mut builder = self.raw_builder.lock();
        builder.reconnect_backoff(initial, max).map_err(|e| {
            napi_err(format!(
                "reconnectBackoff(initialMs: {}, maxMs: {}): {e}",
                js_number(initial_ms),
                js_number(max_ms)
            ))
        })?;
        Ok(self)
    }

    /// Configures whether each wait between reconnect attempts is scaled by a
    /// random factor in [0, 1). On by default, so that sessions that lose
    /// their connections together don't all reconnect at the same moment.
    #[napi]
    pub fn reconnect_jitter(&mut self, enabled: bool) -> &Self {
        let mut builder = self.raw_builder.lock();
        builder.reconnect_jitter(enabled);
        self
    }

    /// Configures the session to stop reconnecting after `attempts` failed
    /// attempts in one outage, counting the immediate first attempt. Each new
    /// outage starts the count again. By default the session never stops on
    /// its own.
    ///
    /// When the session stops, every listener stops forwarding with the last
    /// attempt's error: [Listener::forward] rejects with an error whose message
    /// starts "error forwarding:", and [Listener::join] with one that starts
    /// "error on join:". Nothing rejects for the forwarding that `ngrok.forward`
    /// starts. `listenAndServe` does not await the forwarding it starts, so its
    /// rejection is unhandled, which ends the process under Node's default
    /// `--unhandled-rejections=throw`. The
    /// [SessionBuilder::handleDisconnection] handler is called before each
    /// attempt, and not again once the session stops.
    ///
    /// `attempts` must be a whole number from 1 to 4294967295; anything else,
    /// a fraction, NaN or Infinity included, is refused with an error naming
    /// the argument.
    #[napi]
    pub fn reconnect_max_attempts(&mut self, attempts: f64) -> Result<&Self> {
        let attempts = whole_number(attempts)
            .and_then(|n| u32::try_from(n).ok())
            .and_then(NonZeroU32::new)
            .ok_or_else(|| {
                napi_err(format!(
                    "attempts must be a whole number from 1 to {}, got {}",
                    u32::MAX,
                    js_number(attempts)
                ))
            })?;
        let mut builder = self.raw_builder.lock();
        builder.reconnect_max_attempts(attempts);
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

    /// Sets the file path to a default certificate in PEM format to validate ngrok Session TLS connections.
    /// Setting to "trusted" is the default, using the ngrok CA certificate.
    /// Setting to "host" will verify using the certificates on the host operating system.
    /// A client config set via tls_config after calling root_cas will override this value.
    ///
    /// Corresponds to the [root_cas parameter in the ngrok docs]
    ///
    /// [root_cas parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#root_cas
    #[napi]
    pub fn root_cas(&mut self, root_cas: String) -> Result<&Self> {
        let mut builder = self.raw_builder.lock();
        builder
            .root_cas(root_cas)
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
                        // call javascript handler; the return value is unused, so
                        // name the type explicitly rather than relying on
                        // never-type fallback (which newer rustc resolves to `!`)
                        handler
                            .clone()
                            .lock()
                            .await
                            .call_async::<()>(args)
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

/// `n` as a u64 if it is a whole number from 0 to u64::MAX, else None.
fn whole_number(n: f64) -> Option<u64> {
    // 2^64 itself is exactly representable, and the first value out of range.
    (n.fract() == 0.0 && (0.0..18_446_744_073_709_551_616.0).contains(&n)).then_some(n as u64)
}

/// `n` for error messages: NaN and Infinity spelled as JavaScript spells them,
/// other values as Rust prints them, which differs from JavaScript for -0 and
/// for values JavaScript writes with an exponent.
fn js_number(n: f64) -> String {
    if n.is_nan() {
        "NaN".to_string()
    } else if n.is_infinite() {
        if n > 0.0 { "Infinity" } else { "-Infinity" }.to_string()
    } else {
        n.to_string()
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
