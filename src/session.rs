use std::{
    sync::Arc,
    time::Duration,
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
        SessionBuilder,
        Update,
    },
    Session,
};
use tokio::sync::Mutex;
use tracing::debug;
use tracing_subscriber::{
    self,
    fmt::format::FmtSpan,
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

/// The builder for an ngrok session.
#[napi]
#[allow(dead_code)]
struct NgrokSessionBuilder {
    raw_builder: SessionBuilder,
}

/// turn on tracing subscriber which obeys NGROK_LOG env variable, e.g.:
/// process.env.NGROK_LOG = 'ngrok=debug';
/// ngrok.tracingSubscriber();
#[napi()]
pub fn tracing_subscriber() {
    tracing_subscriber::fmt()
        .pretty()
        .with_span_events(FmtSpan::ENTER)
        .with_env_filter(std::env::var("NGROK_LOG").unwrap_or_default())
        .init();
}

#[napi]
#[cfg_attr(feature = "cargo-clippy", allow(clippy::new_without_default))]
#[allow(dead_code)]
impl NgrokSessionBuilder {
    /// Create a new session builder
    #[napi(constructor)]
    pub fn new() -> Self {
        NgrokSessionBuilder {
            raw_builder: Session::builder(),
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
        // can't put lifetimes or generics on napi structs, which limits our options.
        // there is a Reference which can force static lifetime, but haven't figured
        // out a way to make this actually helpful. so send in the clones.
        // https://napi.rs/docs/concepts/reference
        self.raw_builder = self.raw_builder.clone().authtoken(authtoken);
        self
    }

    /// Shortcut for calling [SessionBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi]
    pub fn authtoken_from_env(&mut self) -> &Self {
        self.raw_builder = self.raw_builder.clone().authtoken_from_env();
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
        self.raw_builder = self
            .raw_builder
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
        self.raw_builder = self
            .raw_builder
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
        self.raw_builder = self.raw_builder.clone().metadata(metadata);
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
        self.raw_builder = self.raw_builder.clone().server_addr(addr).clone();
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
    pub fn handle_stop_command(&mut self, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_no_io_tsfn(handler);
        // register stop handler
        self.raw_builder = self
            .raw_builder
            .clone()
            .handle_stop_command(move |_req| {
                let tsfn = tsfn.clone();
                async move {
                    tsfn.clone()
                        .lock()
                        .await
                        .call((), ThreadsafeFunctionCallMode::NonBlocking);
                    Ok(())
                }
            })
            .clone();
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
    pub fn handle_restart_command(&mut self, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn = create_no_io_tsfn(handler);
        // register restart handler
        self.raw_builder = self
            .raw_builder
            .clone()
            .handle_restart_command(move |_req| {
                let tsfn = tsfn.clone();
                async move {
                    tsfn.clone()
                        .lock()
                        .await
                        .call((), ThreadsafeFunctionCallMode::NonBlocking);
                    Ok(())
                }
            })
            .clone();
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
    pub fn handle_update_command(&mut self, handler: JsFunction) -> &Self {
        // create threadsafe function
        let tsfn: Arc<Mutex<ThreadsafeFunction<UpdateRequest, ErrorStrategy::Fatal>>> =
            Arc::new(Mutex::new(
                handler
                    .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<UpdateRequest>| {
                        Ok(vec![ctx.value])
                    })
                    .expect("Failed to create update callback function"),
            ));
        // register update handler
        self.raw_builder = self
            .raw_builder
            .clone()
            .handle_update_command(move |req: Update| {
                let tsfn = tsfn.clone();
                let update = UpdateRequest {
                    version: req.version,
                    permit_major_version: req.permit_major_version,
                };

                async move {
                    tsfn.clone()
                        .lock()
                        .await
                        .call(update, ThreadsafeFunctionCallMode::NonBlocking);
                    Ok(())
                }
            })
            .clone();
        self
    }

    // Omitting these configurations:
    // tls_config(&mut self, config: rustls::ClientConfig)
    // connector(&mut self, connect: ConnectFn)

    /// Attempt to establish an ngrok session using the current configuration.
    #[napi]
    pub async fn connect(&self) -> Result<NgrokSession> {
        self.raw_builder
            .connect()
            .await
            .map(|s| NgrokSession { raw_session: s })
            .map_err(|e| napi_err(format!("failed to connect session, {e:?}")))
    }
}

/// An ngrok session.
#[napi(custom_finalize)]
struct NgrokSession {
    #[allow(dead_code)]
    raw_session: Session,
}

#[napi]
#[allow(dead_code)]
impl NgrokSession {
    /// Start building a tunnel backing an HTTP endpoint.
    #[napi]
    pub fn http_endpoint(&self) -> NgrokHttpTunnelBuilder {
        NgrokHttpTunnelBuilder::new(self.raw_session.clone(), self.raw_session.http_endpoint())
    }

    /// Start building a tunnel backing a TCP endpoint.
    #[napi]
    pub fn tcp_endpoint(&self) -> NgrokTcpTunnelBuilder {
        NgrokTcpTunnelBuilder::new(self.raw_session.clone(), self.raw_session.tcp_endpoint())
    }

    /// Start building a tunnel backing a TLS endpoint.
    #[napi]
    pub fn tls_endpoint(&self) -> NgrokTlsTunnelBuilder {
        NgrokTlsTunnelBuilder::new(self.raw_session.clone(), self.raw_session.tls_endpoint())
    }

    /// Start building a labeled tunnel.
    #[napi]
    pub fn labeled_tunnel(&self) -> NgrokLabeledTunnelBuilder {
        NgrokLabeledTunnelBuilder::new(self.raw_session.clone(), self.raw_session.labeled_tunnel())
    }

    #[napi]
    pub async fn close_tunnel(&self, id: String) -> Result<()> {
        // close tunnel
        let res = self
            .raw_session
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

pub(crate) fn create_no_io_tsfn(
    js_function: JsFunction,
) -> Arc<Mutex<ThreadsafeFunction<(), ErrorStrategy::Fatal>>> {
    Arc::new(Mutex::new(
        js_function
            .create_threadsafe_function(0, |_ctx: ThreadSafeCallContext<()>| Ok(vec![()]))
            .expect("Failed to create callback function"),
    ))
}
