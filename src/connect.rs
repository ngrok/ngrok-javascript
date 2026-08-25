use lazy_static::lazy_static;
use napi::{
    bindgen_prelude::*,
    JsObject,
};
use napi_derive::napi;
use tokio::sync::Mutex;

use crate::{
    agent::{
        Agent,
        AgentBuilder,
    },
    config::Config,
    endpoint::{
        self,
        Endpoint,
        TCP_PREFIX,
    },
    endpoint_builder::{
        EndpointBuilder,
        UpstreamOptions,
    },
    logging::logging_callback,
    napi_err,
};

lazy_static! {
    // Save a user-facing Agent to use for connect use cases
    pub(crate) static ref AGENT: Mutex<Option<Agent>> = Mutex::new(None);
}

/// Alias for {@link forward}.
///
/// See {@link forward} for the full set of options.
#[napi(
    ts_args_type = "config: Config|string|number",
    ts_return_type = "Promise<Endpoint>"
)]
pub fn connect(
    env: Env,
    cfg: Config,
    on_log_event: Option<JsFunction>,
    on_status_change: Option<JsFunction>,
) -> Result<JsObject> {
    forward(env, cfg, on_log_event, on_status_change)
}

/// Transform a json object configuration into an endpoint.
/// See {@link Config} for the full set of options.
///
/// Examples:<br>
/// endpoint = await ngrok.forward("localhost:4242");<br>
/// endpoint = await ngrok.forward({addr: "https://localhost:8443", authtoken_from_env: true});<br>
/// endpoint = await ngrok.forward({addr: "localhost:8080", trafficPolicy: myPolicyYaml, authtoken_from_env: true});
#[napi(
    ts_args_type = "config: Config|string|number",
    ts_return_type = "Promise<Endpoint>"
)]
pub fn forward(
    env: Env,
    mut cfg: Config,
    on_log_event: Option<JsFunction>,
    on_status_change: Option<JsFunction>,
) -> Result<JsObject> {
    // do logging configuration before anything else
    if on_log_event.is_some() {
        logging_callback(env, on_log_event, None)?;
    }
    set_defaults(&mut cfg);

    // agent configuration
    let mut a_builder = AgentBuilder::new();
    if let Some(ref authtoken) = cfg.authtoken {
        a_builder.authtoken(authtoken.clone());
    }
    if let Some(true) = cfg.authtoken_from_env {
        a_builder.authtoken_from_env();
    }
    if let Some(ref metadata) = cfg.session_metadata {
        a_builder.metadata(metadata.clone());
    }
    if let Some(ref connect_url) = cfg.connect_url {
        a_builder.connect_url(connect_url.clone());
    }
    if let Some(func) = on_status_change {
        a_builder.set_status_handler(env, func);
    }

    // no longer need Env, hand off to async for endpoint creation, returning the promise to nodejs.
    env.spawn_future(async_connect(a_builder, cfg))
}

/// Connect the agent, configure and start the endpoint
async fn async_connect(a_builder: AgentBuilder, config: Config) -> Result<Endpoint> {
    let force_new_session = config.force_new_session.unwrap_or(false);

    // Using a singleton agent for connect use cases
    let mut opt = AGENT.lock().await;
    if opt.is_none() || force_new_session {
        opt.replace(a_builder.connect().await?);
    }
    let agent = opt.as_ref().unwrap();

    let proto = config.proto.as_ref().unwrap();
    match proto.as_str() {
        "http" => http_endpoint(agent, &config).await,
        "tcp" => tcp_endpoint(agent, &config).await,
        "tls" => tls_endpoint(agent, &config).await,
        _ => Err(napi_err(format!("unhandled protocol {proto}"))),
    }
}

/// HTTP endpoint configuration
async fn http_endpoint(agent: &Agent, cfg: &Config) -> Result<Endpoint> {
    let bld = agent.http_endpoint();
    apply_common(&bld, cfg);
    if let Some(domain) = cfg.domain.clone().or_else(|| cfg.hostname.clone()) {
        bld.domain(domain);
    }
    listen_or_forward(&bld, cfg).await
}

/// TCP endpoint configuration
async fn tcp_endpoint(agent: &Agent, cfg: &Config) -> Result<Endpoint> {
    let bld = agent.tcp_endpoint();
    apply_common(&bld, cfg);
    if let Some(ref remote_addr) = cfg.remote_addr {
        bld.remote_addr(remote_addr.clone());
    }
    listen_or_forward(&bld, cfg).await
}

/// TLS endpoint configuration
async fn tls_endpoint(agent: &Agent, cfg: &Config) -> Result<Endpoint> {
    let bld = agent.tls_endpoint();
    apply_common(&bld, cfg);
    if let Some(domain) = cfg.domain.clone().or_else(|| cfg.hostname.clone()) {
        bld.domain(domain);
    }
    listen_or_forward(&bld, cfg).await
}

/// Configuration options common to all endpoint types.
fn apply_common(bld: &EndpointBuilder, cfg: &Config) {
    if let Some(ref name) = cfg.name {
        bld.name(name.clone());
    }
    if let Some(ref description) = cfg.description {
        bld.description(description.clone());
    }
    if let Some(ref metadata) = cfg.metadata {
        bld.metadata(metadata.clone());
    }
    if let Some(ref traffic_policy) = cfg.traffic_policy {
        bld.traffic_policy(traffic_policy.clone());
    }
    if let Some(pooling_enabled) = cfg.pooling_enabled {
        bld.pooling_enabled(pooling_enabled);
    }
    if let Some(ref binding) = cfg.binding {
        bld.binding(binding.clone());
    }
}

async fn listen_or_forward(bld: &EndpointBuilder, cfg: &Config) -> Result<Endpoint> {
    if let Some(ref addr) = cfg.addr {
        let upstream = if cfg.upstream_protocol.is_some()
            || cfg.verify_upstream_tls.is_some()
            || cfg.proxy_proto.is_some()
        {
            Some(UpstreamOptions {
                protocol: cfg.upstream_protocol.clone(),
                verify_upstream_tls: cfg.verify_upstream_tls,
                proxy_proto: cfg.proxy_proto.clone(),
            })
        } else {
            None
        };
        bld.forward(addr.clone(), upstream).await
    } else {
        bld.listen().await
    }
}

/// Set the expected defaults for configuration values
fn set_defaults(config: &mut Config) {
    if config.proto.is_none() {
        config.proto.replace("http".to_string());
    }
    if config.addr.is_none() {
        if let Some(port) = &config.port {
            if let Some(host) = &config.host {
                config.addr.replace(format!("{TCP_PREFIX}{host}:{port}"));
            } else {
                config.addr.replace(format!("{TCP_PREFIX}localhost:{port}"));
            }
        } else if let Some(host) = &config.host {
            config.addr.replace(host.clone());
        } else {
            config.addr.replace("80".to_string());
        }
    }
    if let Some(addr) = &config.addr {
        if addr.parse::<i32>().is_ok() {
            // the string is a number, interpret it as a port
            config.addr.replace(format!("{TCP_PREFIX}localhost:{addr}"));
        }
    }
}

/// Close an endpoint with the given url, or all endpoints if no url is defined.
#[napi]
#[allow(dead_code)]
pub async fn disconnect(url: Option<String>) -> Result<()> {
    endpoint::close_url(url.clone()).await?;

    // if closing every endpoint, disconnect and remove the stored agent
    if url.as_ref().is_none() {
        if let Some(agent) = AGENT.lock().await.take() {
            agent.disconnect().await?;
        }
    }

    Ok(())
}

/// Disconnect and close all endpoints.
#[napi]
#[allow(dead_code)]
pub async fn kill() -> Result<()> {
    disconnect(None).await
}
