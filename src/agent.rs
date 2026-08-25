use std::{
    env,
    sync::Arc,
    time::{
        Duration,
        SystemTime,
        UNIX_EPOCH,
    },
};

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
    Agent as NgrokAgent,
    AgentBuilder as NgrokAgentBuilder,
    Event as NgrokEvent,
    RpcMethod,
    RpcResponse,
};
use parking_lot::Mutex as SyncMutex;
use tokio::sync::Mutex;
use tracing::{
    debug,
    info,
};

use crate::{
    endpoint::{
        search_endpoints,
        Endpoint,
    },
    endpoint_builder::EndpointBuilder,
    napi_err,
    napi_ngrok_err,
};

const CLIENT_TYPE: &str = "ngrok-javascript";
const VERSION: &str = env!("CARGO_PKG_VERSION");

type EventTsfn = Arc<Mutex<ThreadsafeFunction<Vec<AgentEvent>, ErrorStrategy::Fatal>>>;
type RpcTsfn = Arc<Mutex<ThreadsafeFunction<Vec<AgentRpcRequest>, ErrorStrategy::Fatal>>>;
type StringTsfn = Arc<Mutex<ThreadsafeFunction<Vec<String>, ErrorStrategy::Fatal>>>;

lazy_static! {
    // Allow user to store a default auth token to use for any future agents.
    static ref AUTH_TOKEN: Mutex<Option<String>> = Mutex::new(None);
}

/// Set the default auth token to use for any future agents.
#[napi]
#[allow(dead_code)]
pub async fn authtoken(authtoken: String) {
    let mut token = AUTH_TOKEN.lock().await;
    token.replace(authtoken);
}

/// An event dispatched by the agent. `kind` discriminates which of the other fields are
/// populated:
///
/// - `"connectSucceeded"`: sessionId
/// - `"disconnected"`: sessionId, error
/// - `"heartbeatReceived"`: sessionId, latencyMs
/// - `"connectionOpened"`: endpointId, remoteAddr
/// - `"connectionClosed"`: endpointId, remoteAddr, durationMs, bytesIn, bytesOut
/// - `"httpRequestComplete"`: endpointId, method, path, statusCode, durationMs
///
/// @group Agent
#[napi(object)]
#[derive(Clone, Default)]
pub struct AgentEvent {
    pub kind: String,
    pub occurred_at_ms: f64,
    pub session_id: Option<String>,
    pub error: Option<String>,
    pub latency_ms: Option<f64>,
    pub endpoint_id: Option<String>,
    pub remote_addr: Option<String>,
    pub duration_ms: Option<f64>,
    pub bytes_in: Option<f64>,
    pub bytes_out: Option<f64>,
    pub method: Option<String>,
    pub path: Option<String>,
    pub status_code: Option<f64>,
}

fn to_ms(t: SystemTime) -> f64 {
    t.duration_since(UNIX_EPOCH)
        .map(|d| d.as_secs_f64() * 1000.0)
        .unwrap_or(0.0)
}

fn to_agent_event(event: NgrokEvent) -> Option<AgentEvent> {
    let base = AgentEvent::default();
    Some(match event {
        NgrokEvent::AgentConnectSucceeded(e) => AgentEvent {
            kind: "connectSucceeded".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            session_id: Some(e.session.id().to_string()),
            ..base
        },
        NgrokEvent::AgentDisconnected(e) => AgentEvent {
            kind: "disconnected".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            session_id: Some(e.session.id().to_string()),
            error: e.error.clone(),
            ..base
        },
        NgrokEvent::AgentHeartbeatReceived(e) => AgentEvent {
            kind: "heartbeatReceived".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            session_id: Some(e.session.id().to_string()),
            latency_ms: Some(e.latency.as_secs_f64() * 1000.0),
            ..base
        },
        NgrokEvent::ConnectionOpened(e) => AgentEvent {
            kind: "connectionOpened".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            endpoint_id: Some(e.endpoint_id),
            remote_addr: Some(e.remote_addr),
            ..base
        },
        NgrokEvent::ConnectionClosed(e) => AgentEvent {
            kind: "connectionClosed".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            endpoint_id: Some(e.endpoint_id),
            remote_addr: Some(e.remote_addr),
            duration_ms: Some(e.duration.as_secs_f64() * 1000.0),
            bytes_in: Some(e.bytes_in as f64),
            bytes_out: Some(e.bytes_out as f64),
            ..base
        },
        NgrokEvent::HttpRequestComplete(e) => AgentEvent {
            kind: "httpRequestComplete".into(),
            occurred_at_ms: to_ms(e.occurred_at),
            endpoint_id: Some(e.endpoint_id),
            method: Some(e.method),
            path: Some(e.path),
            status_code: Some(e.status_code as f64),
            duration_ms: Some(e.duration.as_secs_f64() * 1000.0),
            ..base
        },
        _ => return None,
    })
}

/// A server-initiated RPC request from ngrok cloud. `method` is one of
/// `"stop"`, `"restart"`, or `"update"`.
///
/// @group Agent
#[napi(object)]
#[derive(Clone)]
pub struct AgentRpcRequest {
    pub method: String,
}

fn create_tsfn<A>(
    env: Env,
    handler: JsFunction,
) -> Arc<Mutex<ThreadsafeFunction<Vec<A>, ErrorStrategy::Fatal>>>
where
    A: ToNapiValue,
{
    Arc::new(Mutex::new({
        let mut tsfn = handler
            .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<Vec<A>>| Ok(ctx.value))
            .expect("Failed to create callback function");
        // tell the runtime it can exit while this callback exists
        tsfn.unref(&env).expect("Failed to unref callback function");
        tsfn
    }))
}

/// The builder for an ngrok agent.
///
/// NOTE: this fork's `AgentBuilder` only allows registering a single `onEvent` and a
/// single `onRpc` handler (rather than the old builder's many discrete
/// `handleXxxCommand`/`handleHeartbeat`/etc. callbacks), and `onRpc` handlers are
/// fire-and-forget -- errors thrown from a JS RPC handler can no longer be reported
/// back to ngrok cloud.
///
/// @group Agent
#[napi]
#[allow(dead_code)]
pub struct AgentBuilder {
    inner: Arc<SyncMutex<Option<NgrokAgentBuilder>>>,
    event_handler: Arc<SyncMutex<Option<EventTsfn>>>,
    rpc_handler: Arc<SyncMutex<Option<RpcTsfn>>>,
    // Used internally by connect.rs's `onStatusChange` convenience -- not JS-exposed.
    status_handler: Arc<SyncMutex<Option<StringTsfn>>>,
    auth_token_set: bool,
}

impl Default for AgentBuilder {
    fn default() -> Self {
        Self::new()
    }
}

#[napi]
#[allow(dead_code)]
impl AgentBuilder {
    /// Create a new agent builder.
    #[napi(constructor)]
    pub fn new() -> Self {
        let event_handler: Arc<SyncMutex<Option<EventTsfn>>> = Arc::new(SyncMutex::new(None));
        let rpc_handler: Arc<SyncMutex<Option<RpcTsfn>>> = Arc::new(SyncMutex::new(None));
        let status_handler: Arc<SyncMutex<Option<StringTsfn>>> = Arc::new(SyncMutex::new(None));

        let eh = event_handler.clone();
        let rh = rpc_handler.clone();
        let sh = status_handler.clone();

        let builder = NgrokAgent::builder()
            .client_info(CLIENT_TYPE, VERSION)
            .on_event(move |event| {
                let Some(js_event) = to_agent_event(event) else {
                    return;
                };
                if let Some(tsfn) = eh.lock().clone() {
                    let ev = js_event.clone();
                    tokio::spawn(async move {
                        tsfn.lock()
                            .await
                            .call(vec![ev], ThreadsafeFunctionCallMode::NonBlocking);
                    });
                }
                if let Some(tsfn) = sh.lock().clone() {
                    let status = match js_event.kind.as_str() {
                        "connectSucceeded" => Some("connected".to_string()),
                        "disconnected" => Some("closed".to_string()),
                        _ => None,
                    };
                    if let Some(status) = status {
                        tokio::spawn(async move {
                            tsfn.lock()
                                .await
                                .call(vec![status], ThreadsafeFunctionCallMode::NonBlocking);
                        });
                    }
                }
            })
            .on_rpc(move |req| {
                if let Some(tsfn) = rh.lock().clone() {
                    let method = match req.method {
                        RpcMethod::StopAgent => "stop",
                        RpcMethod::RestartAgent => "restart",
                        RpcMethod::UpdateAgent => "update",
                        _ => "unknown",
                    }
                    .to_string();
                    tokio::spawn(async move {
                        tsfn.lock().await.call(
                            vec![AgentRpcRequest { method }],
                            ThreadsafeFunctionCallMode::NonBlocking,
                        );
                    });
                }
                RpcResponse::default()
            });

        AgentBuilder {
            inner: Arc::new(SyncMutex::new(Some(builder))),
            event_handler,
            rpc_handler,
            status_handler,
            auth_token_set: false,
        }
    }

    /// Used internally by connect.rs's `onStatusChange` convenience -- not JS-exposed.
    pub(crate) fn set_status_handler(&mut self, env: Env, handler: JsFunction) {
        let tsfn = create_tsfn(env, handler);
        *self.status_handler.lock() = Some(tsfn);
    }

    fn with_builder<F>(&self, f: F)
    where
        F: FnOnce(NgrokAgentBuilder) -> NgrokAgentBuilder,
    {
        let mut guard = self.inner.lock();
        if let Some(b) = guard.take() {
            *guard = Some(f(b));
        }
    }

    /// Configures the agent to authenticate with the provided authtoken. You
    /// can [find your existing authtoken] or [create a new one] in the ngrok
    /// dashboard.
    ///
    /// [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
    /// [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
    #[napi]
    pub fn authtoken(&mut self, authtoken: String) -> &Self {
        self.with_builder(|b| b.authtoken(authtoken));
        self.auth_token_set = true;
        self
    }

    /// Shortcut for calling [AgentBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi]
    pub fn authtoken_from_env(&mut self) -> &Self {
        self.with_builder(|b| b.authtoken_from_env());
        if let Ok(token) = env::var("NGROK_AUTHTOKEN") {
            if !token.is_empty() {
                self.auth_token_set = true;
            }
        }
        self
    }

    /// Add client type and version information for a client application. This is a way
    /// for applications and library consumers of this package to identify themselves.
    #[napi]
    pub fn client_info(&mut self, client_type: String, version: String) -> &Self {
        self.with_builder(|b| b.client_info(client_type, version));
        self
    }

    /// Configures the opaque, machine-readable metadata string for this agent's session.
    /// Metadata is made available to you in the ngrok dashboard and the Agents API
    /// resource.
    #[napi]
    pub fn metadata(&mut self, metadata: String) -> &Self {
        self.with_builder(|b| b.metadata(metadata));
        self
    }

    /// Configures how often the agent will send heartbeat messages to the ngrok
    /// service to check session liveness.
    #[napi]
    pub fn heartbeat_interval(&mut self, seconds: u32) -> &Self {
        self.with_builder(|b| b.heartbeat_interval(Duration::new(seconds.into(), 0)));
        self
    }

    /// Configures the duration to wait for a response to a heartbeat before
    /// assuming the connection is dead and reconnecting.
    #[napi]
    pub fn heartbeat_tolerance(&mut self, seconds: u32) -> &Self {
        self.with_builder(|b| b.heartbeat_tolerance(Duration::new(seconds.into(), 0)));
        self
    }

    /// Configures the network address to dial to connect to the ngrok service.
    /// Use this option only if you are connecting to a custom agent ingress.
    #[napi]
    pub fn connect_url(&mut self, addr: String) -> &Self {
        self.with_builder(|b| b.connect_url(addr));
        self
    }

    /// Configures a custom CA certificate used to connect to the ngrok service. Use
    /// this option only if you are connecting through a man-in-the-middle or deep
    /// packet inspection proxy.
    #[napi]
    pub fn connect_ca_cert(&mut self, cert_bytes: Uint8Array) -> &Self {
        let bytes = cert_bytes.to_vec();
        self.with_builder(move |b| b.connect_ca_cert(&bytes));
        self
    }

    /// Configures an HTTP/SOCKS proxy URL to use for the agent's outbound connection to
    /// the ngrok service.
    #[napi]
    pub fn proxy_url(&mut self, url: String) -> &Self {
        self.with_builder(|b| b.proxy_url(url));
        self
    }

    /// Whether to automatically connect to the ngrok service when the agent is built.
    /// Defaults to `true`. Set to `false` to defer connecting until `Agent.connect()`
    /// is called explicitly (or until the first `.endpoint().listen()`/`.forward()`).
    #[napi]
    pub fn auto_connect(&mut self, auto: bool) -> &Self {
        self.with_builder(|b| b.auto_connect(auto));
        self
    }

    /// Register a handler that is called for every {@link AgentEvent} the agent
    /// dispatches (connection lifecycle, heartbeats, per-connection/request events).
    #[napi(ts_args_type = "handler: (event: AgentEvent) => void")]
    pub fn on_event(&mut self, env: Env, handler: JsFunction) -> &Self {
        let tsfn = create_tsfn(env, handler);
        *self.event_handler.lock() = Some(tsfn);
        self
    }

    /// Register a handler for server-initiated RPC requests (stop/restart/update).
    /// Do not block inside this callback -- it runs fire-and-forget and its result
    /// cannot be reported back to ngrok cloud.
    #[napi(ts_args_type = "handler: (request: AgentRpcRequest) => void")]
    pub fn on_rpc(&mut self, env: Env, handler: JsFunction) -> &Self {
        let tsfn = create_tsfn(env, handler);
        *self.rpc_handler.lock() = Some(tsfn);
        self
    }

    /// Attempt to establish an ngrok agent session using the current configuration.
    #[napi]
    pub async fn connect(&self) -> Result<Agent> {
        let taken = { self.inner.lock().take() };
        let mut builder =
            taken.ok_or_else(|| napi_err("AgentBuilder has already been connected"))?;

        let default_auth_token = AUTH_TOKEN.lock().await;
        let mut auth_token_set = self.auth_token_set;
        if default_auth_token.is_some() && !self.auth_token_set {
            builder = builder.authtoken(default_auth_token.as_ref().unwrap().clone());
            auth_token_set = true;
        }
        drop(default_auth_token);

        builder
            .build()
            .await
            .map(|agent| {
                let maybe_with = if auth_token_set { "with" } else { "without" };
                info!("Agent created, {maybe_with} auth token");
                Agent { agent }
            })
            .map_err(|e| napi_ngrok_err("failed to connect agent", &e))
    }
}

/// A connected ngrok agent.
///
/// Manages authentication, the persistent session with ngrok cloud, and all open
/// endpoints. Use {@link AgentBuilder} to create one.
///
/// @group Agent
#[napi(custom_finalize)]
pub struct Agent {
    agent: NgrokAgent,
}

#[napi]
#[allow(dead_code)]
impl Agent {
    /// Start building a listener/forwarder backing an HTTP endpoint.
    #[napi]
    pub fn http_endpoint(&self) -> EndpointBuilder {
        EndpointBuilder::new(self.agent.clone(), "https")
    }

    /// Start building a listener/forwarder backing a TCP endpoint.
    #[napi]
    pub fn tcp_endpoint(&self) -> EndpointBuilder {
        EndpointBuilder::new(self.agent.clone(), "tcp")
    }

    /// Start building a listener/forwarder backing a TLS endpoint.
    #[napi]
    pub fn tls_endpoint(&self) -> EndpointBuilder {
        EndpointBuilder::new(self.agent.clone(), "tls")
    }

    /// Retrieve a list of this agent's non-closed endpoints, in no particular order.
    #[napi]
    pub async fn endpoints(&self) -> Vec<Endpoint> {
        let session_id = self.agent.session().map(|s| s.id().to_string());
        search_endpoints(session_id, None).await
    }

    /// Close an endpoint with the given ID.
    #[napi]
    pub async fn close_endpoint(&self, id: String) -> Result<()> {
        match crate::endpoint::get_endpoint(id).await {
            Some(endpoint) => endpoint.close().await,
            None => Err(napi_err("Endpoint is no longer running")),
        }
    }

    /// Run a connectivity probe against ngrok cloud without authenticating. Useful for
    /// diagnosing network/firewall/proxy issues independent of authtoken validity.
    #[napi]
    pub async fn diagnose(&self, addr: Option<String>) -> Result<DiagnoseResult> {
        self.agent
            .diagnose(addr.as_deref())
            .await
            .map(|r| DiagnoseResult {
                addr: r.addr,
                region: r.region,
                latency_ms: r.latency.as_secs_f64() * 1000.0,
            })
            .map_err(|e| napi_err(format!("diagnose failed: {e}")))
    }

    /// Disconnect the ngrok agent. All open endpoints signal completion.
    #[napi]
    pub async fn disconnect(&self) -> Result<()> {
        self.agent
            .disconnect()
            .await
            .map_err(|e| napi_ngrok_err("failed to disconnect agent", &e))
    }
}

impl ObjectFinalize for Agent {
    fn finalize(self, mut _env: Env) -> Result<()> {
        debug!("Agent finalize");
        Ok(())
    }
}

/// The result of a successful connectivity probe. See {@link Agent.diagnose}.
///
/// @group Agent
#[napi(object)]
pub struct DiagnoseResult {
    pub addr: String,
    pub region: String,
    pub latency_ms: f64,
}
