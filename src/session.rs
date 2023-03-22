use std::{
    io,
    sync::Arc,
    time::Duration,
};

use async_rustls::rustls::{
    self,
    ClientConfig,
};
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
        SessionBuilder,
        Update,
    },
    tunnel::AcceptError,
    Session,
};
use parking_lot::Mutex as SyncMutex;
use rustls_pemfile::Item;
use tokio::sync::Mutex;
use tracing::{
    debug,
    info,
};

use crate::{
    napi_err,
    tunnel::remove_global_tunnel,
    tunnel_builder::{
        NgrokHttpTunnelBuilder,
        NgrokLabeledTunnelBuilder,
        NgrokTcpTunnelBuilder,
        NgrokTlsTunnelBuilder,
    },
};

const CLIENT_TYPE: &str = "library/official/nodejs";
const VERSION: &str = env!("CARGO_PKG_VERSION");

/// The builder for an ngrok session.
#[napi]
#[allow(dead_code)]
struct NgrokSessionBuilder {
    raw_builder: Arc<SyncMutex<SessionBuilder>>,
}

#[napi]
#[cfg_attr(feature = "cargo-clippy", allow(clippy::new_without_default))]
#[allow(dead_code)]
impl NgrokSessionBuilder {
    /// Create a new session builder
    #[napi(constructor)]
    pub fn new() -> Self {
        NgrokSessionBuilder {
            raw_builder: Arc::new(SyncMutex::new(
                Session::builder().child_client(CLIENT_TYPE, VERSION),
            )),
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
        *builder = builder.clone().authtoken(authtoken);
        self
    }

    /// Shortcut for calling [SessionBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi]
    pub fn authtoken_from_env(&mut self) -> &Self {
        let mut builder = self.raw_builder.lock();
        *builder = builder.clone().authtoken_from_env();
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
    pub fn heartbeat_interval(&mut self, heartbeat_interval: u32) -> &Self {
        let mut builder = self.raw_builder.lock();
        *builder = builder
            .clone()
            .heartbeat_interval(Duration::new(heartbeat_interval.into(), 0));
        self
    }

    /// Configures the duration to wait for a response to a heartbeat before
    /// assuming the session connection is dead and attempting to reconnect.
    ///
    /// See the [heartbeat_tolerance parameter in the ngrok docs] for additional
    /// details.
    ///
    /// [heartbeat_tolerance parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#heartbeat_tolerance
    #[napi]
    pub fn heartbeat_tolerance(&mut self, heartbeat_tolerance: u32) -> &Self {
        let mut builder = self.raw_builder.lock();
        *builder = builder
            .clone()
            .heartbeat_tolerance(Duration::new(heartbeat_tolerance.into(), 0));
        self
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
        *builder = builder.clone().metadata(metadata);
        self
    }

    /// Configures the network address to dial to connect to the ngrok service.
    /// Use this option only if you are connecting to a custom agent ingress.
    ///
    /// See the [server_addr parameter in the ngrok docs] for additional details.
    ///
    /// [server_addr parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#server_addr
    #[napi]
    pub fn server_addr(&mut self, addr: String) -> &Self {
        let mut builder = self.raw_builder.lock();
        *builder = builder.clone().server_addr(addr);
        self
    }

    /// Configures the TLS client used to connect to the ngrok service while
    /// establishing the session. Use this option only if you are connecting through
    /// a man-in-the-middle or deep packet inspection proxy. Pass in the bytes of the certificate
    /// to be used to validate the connection, then override the address to connect to via
    /// the connector call.
    ///
    /// Roughly corresponds to the [root_cas parameter in the ngrok docs].
    ///
    /// [root_cas parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#root_cas
    #[napi]
    pub fn tls_config(&mut self, cert_bytes: Uint8Array) -> &Self {
        let mut root_store = rustls::RootCertStore::empty();
        let mut cert_pem = io::Cursor::new(cert_bytes);
        root_store.add_parsable_certificates(
            rustls_pemfile::read_all(&mut cert_pem)
                .expect("a valid root certificate")
                .into_iter()
                .filter_map(|it| match it {
                    Item::X509Certificate(bs) => Some(bs),
                    _ => None,
                })
                .collect::<Vec<_>>()
                .as_slice(),
        );

        let tls_config = rustls::ClientConfig::builder()
            .with_safe_defaults()
            .with_root_certificates(root_store)
            .with_no_client_auth();

        let mut builder = self.raw_builder.lock();
        *builder = builder.clone().tls_config(tls_config);
        self
    }

    /// Configures a function which is called to establish the connection to the
    /// ngrok service. Use this option if you need to connect through an outbound
    /// proxy. In the event of network disruptions, it will be called each time
    /// the session reconnects. If the handler responds with a string it will be
    /// used as the new address to connect to, e.g. "192.168.1.1:443".
    #[napi(ts_args_type = "handler: (addr: string, error?: string) => string")]
    pub fn connector(&mut self, env: Env, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_tsfn(env, handler);

        // register connect handler. this needs the return value, so cannot use call_tsfn().
        let mut builder = self.raw_builder.lock();
        *builder = builder.clone().connector(
            move |addr: String, tls_config: Arc<ClientConfig>, err: Option<AcceptError>| {
                let tsfn = tsfn.clone();
                let mut args = vec![addr.clone()];
                if err.is_some() {
                    args.push(err.clone().unwrap().to_string());
                }

                async move {
                    // call javascript handler
                    let result: Option<String> = tsfn
                        .clone()
                        .lock()
                        .await
                        .call_async(args)
                        .await
                        .map_err(|_e| ConnectError::Canceled)?;
                    // call the upstream connector
                    let new_addr = match result {
                        Some(result) => result,
                        None => addr,
                    };
                    default_connect(new_addr, tls_config, err).await
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
        *builder = builder
            .clone()
            .handle_stop_command(move |_req| call_tsfn(tsfn.clone(), ()));
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
        *builder = builder
            .clone()
            .handle_restart_command(move |_req| call_tsfn(tsfn.clone(), ()));
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
        *builder = builder.clone().handle_update_command(move |req: Update| {
            let update = UpdateRequest {
                version: req.version,
                permit_major_version: req.permit_major_version,
            };
            call_tsfn(tsfn.clone(), update)
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
        *builder = builder
            .clone()
            .handle_heartbeat(move |latency: Option<Duration>| {
                call_tsfn(
                    tsfn.clone(),
                    latency.map(|d| u32::try_from(d.as_millis()).ok()),
                )
            });
        self
    }

    /// Attempt to establish an ngrok session using the current configuration.
    #[napi]
    pub async fn connect(&self) -> Result<NgrokSession> {
        let builder = self.raw_builder.lock().clone();
        builder
            .connect()
            .await
            .map(|s| {
                info!("Session created");
                NgrokSession {
                    raw_session: Arc::new(SyncMutex::new(s)),
                }
            })
            .map_err(|e| napi_err(format!("failed to connect session, {e:?}")))
    }
}

/// An ngrok session.
#[napi(custom_finalize)]
struct NgrokSession {
    #[allow(dead_code)]
    raw_session: Arc<SyncMutex<Session>>,
}

#[napi]
#[allow(dead_code)]
impl NgrokSession {
    /// Start building a tunnel backing an HTTP endpoint.
    #[napi]
    pub fn http_endpoint(&self) -> NgrokHttpTunnelBuilder {
        let session = self.raw_session.lock().clone();
        NgrokHttpTunnelBuilder::new(session.clone(), session.http_endpoint())
    }

    /// Start building a tunnel backing a TCP endpoint.
    #[napi]
    pub fn tcp_endpoint(&self) -> NgrokTcpTunnelBuilder {
        let session = self.raw_session.lock().clone();
        NgrokTcpTunnelBuilder::new(session.clone(), session.tcp_endpoint())
    }

    /// Start building a tunnel backing a TLS endpoint.
    #[napi]
    pub fn tls_endpoint(&self) -> NgrokTlsTunnelBuilder {
        let session = self.raw_session.lock().clone();
        NgrokTlsTunnelBuilder::new(session.clone(), session.tls_endpoint())
    }

    /// Start building a labeled tunnel.
    #[napi]
    pub fn labeled_tunnel(&self) -> NgrokLabeledTunnelBuilder {
        let session = self.raw_session.lock().clone();
        NgrokLabeledTunnelBuilder::new(session.clone(), session.labeled_tunnel())
    }

    /// Close a tunnel with the given ID.
    #[napi]
    pub async fn close_tunnel(&self, id: String) -> Result<()> {
        let session = self.raw_session.lock().clone();
        // close tunnel
        let res = session
            .close_tunnel(id.clone())
            .await
            .map_err(|e| napi_err(format!("failed to close tunnel, {e:?}")));

        if res.is_ok() {
            // remove our reference to allow it to drop
            remove_global_tunnel(&id).await;
        }
        res
    }
}

impl ObjectFinalize for NgrokSession {
    fn finalize(self, mut _env: Env) -> Result<()> {
        debug!("NgrokSession finalize");
        Ok(())
    }
}

#[derive(Clone)]
#[napi]
pub struct UpdateRequest {
    /// The version that the agent is requested to update to.
    pub version: String,
    /// Whether or not updating to the same major version is sufficient.
    pub permit_major_version: bool,
}

/// Create a threadsafe function that has the given argument type and no return value.
pub(crate) fn create_tsfn<A>(
    env: Env,
    handler: JsFunction,
) -> Arc<Mutex<ThreadsafeFunction<A, ErrorStrategy::Fatal>>>
where
    A: ToNapiValue,
{
    Arc::new(Mutex::new({
        let mut tsfn = handler
            .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<A>| Ok(vec![ctx.value]))
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
