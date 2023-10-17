use lazy_static::lazy_static;
use napi::{
    bindgen_prelude::*,
    JsObject,
};
use napi_derive::napi;
use tokio::sync::Mutex;
use tracing::warn;

use crate::{
    config::Config,
    listener::{
        self,
        Listener,
        TCP_PREFIX,
    },
    logging::logging_callback,
    napi_err,
    session::{
        Session,
        SessionBuilder,
    },
};

lazy_static! {
    // Save a user-facing NgrokSession to use for connect use cases
    pub(crate) static ref SESSION: Mutex<Option<Session>> = Mutex::new(None);
}

/// Single string configuration
macro_rules! plumb {
    ($builder:tt, $config:tt, $name:tt) => {
        plumb!($builder, $config, $name, $name)
    };
    ($builder:tt, $config:tt, $name:tt, $config_name:tt) => {
        if let Some(ref $name) = $config.$config_name {
            $builder.$name($name.clone());
        }
    };
}

/// Boolean configuration
macro_rules! plumb_bool {
    ($builder:tt, $config:tt, $name:tt) => {
        plumb_bool!($builder, $config, $name, $name)
    };
    ($builder:tt, $config:tt, $name:tt, $config_name:tt) => {
        if let Some($name) = $config.$config_name {
            if $name {
                $builder.$name();
            }
        }
    };
}

/// Vector configuration
macro_rules! plumb_vec {
    ($builder:tt, $config:tt, $name:tt) => {
        plumb_vec!($builder, $config, $name, $name)
    };
    ($builder:tt, $config:tt, $name:tt, $config_name:tt) => {
        if let Some(ref $name) = $config.$config_name {
            for val in $name {
                $builder.$name(val.clone());
            }
        }
    };
    ($builder:tt, $config:tt, $name:tt, $config_name:tt, vecu8) => {
        if let Some(ref $name) = $config.$config_name {
            for val in $name {
                $builder.$name(Uint8Array::new(val.as_bytes().to_vec()));
            }
        }
    };
    ($builder:tt, $config:tt, $name:tt, $config_name:tt, $split:tt) => {
        if let Some(ref $name) = $config.$config_name {
            for val in $name {
                let (a, b) = val
                    .split_once($split)
                    .expect("split of value failed: ${val}");
                $builder.$name(a.to_string(), b.to_string());
            }
        }
    };
}

/// All non-labeled listeners have these common configuration options
macro_rules! config_common {
    ($builder:tt, $config:tt) => {
        plumb!($builder, $config, metadata);
        plumb_vec!($builder, $config, allow_cidr);
        plumb_vec!($builder, $config, deny_cidr);
        plumb!($builder, $config, proxy_proto);
        plumb!($builder, $config, forwards_to);
    };
}

/// Transform a json object configuration into a listener
#[napi(
    ts_args_type = "config: Config|string|number",
    ts_return_type = "Promise<Listener>"
)]
#[allow(dead_code)]
pub fn connect(
    env: Env,
    mut cfg: Config,
    on_log_event: Option<JsFunction>,
    on_connection: Option<JsFunction>,
    on_disconnection: Option<JsFunction>,
) -> Result<JsObject> {
    // do logging configuration before anything else
    if on_log_event.is_some() {
        logging_callback(env, on_log_event, None)?;
    }
    warn_unused(&cfg);
    set_defaults(&mut cfg);

    // session configuration
    let mut s_builder = SessionBuilder::new();
    plumb!(s_builder, cfg, authtoken);
    plumb_bool!(s_builder, cfg, authtoken_from_env);
    plumb!(s_builder, cfg, metadata, session_metadata);
    if let Some(func) = on_connection {
        s_builder.handle_connection(env, func);
    }
    if let Some(func) = on_disconnection {
        s_builder.handle_disconnection(env, func);
    }

    // no longer need Env, hand off to async for listener creation, returning the promise to nodejs.
    env.spawn_future(async_connect(s_builder, cfg))
}

/// Connect the session, configure and start the listener
async fn async_connect(s_builder: SessionBuilder, config: Config) -> Result<Listener> {
    // Using a singleton session for connect use cases
    let mut opt = SESSION.lock().await;
    if opt.is_none() {
        opt.replace(s_builder.connect().await?);
    }
    let session = opt.as_ref().unwrap();

    // listener configuration dispatch
    let proto = config.proto.as_ref().unwrap();
    let id = match proto.as_str() {
        "http" => http_endpoint(session, &config).await?,
        "tcp" => tcp_endpoint(session, &config).await?,
        "tls" => tls_endpoint(session, &config).await?,
        "labeled" => labeled_listener(session, &config).await?,
        _ => return Err(napi_err(format!("unhandled protocol {proto}"))),
    };

    let listener = listener::get_listener(id.clone())
        .await
        .ok_or(napi_err("failed to start listener".to_string()))?;

    // move forwarding to another task
    if let Some(addr) = config.addr {
        tokio::spawn(async move { listener::forward(&id, addr).await });
    }

    Ok(listener)
}

/// HTTP Listener configuration
async fn http_endpoint(session: &Session, cfg: &Config) -> Result<String> {
    let mut bld = session.http_endpoint();
    config_common!(bld, cfg);
    plumb_vec!(bld, cfg, scheme, schemes);
    plumb!(bld, cfg, domain, hostname); // synonym for domain
    plumb!(bld, cfg, domain);
    plumb_vec!(bld, cfg, mutual_tlsca, mutual_tls_cas, vecu8);
    plumb_bool!(bld, cfg, compression);
    plumb_bool!(bld, cfg, websocket_tcp_conversion, websocket_tcp_converter);
    plumb_vec!(bld, cfg, request_header, request_header_add, ":");
    plumb_vec!(bld, cfg, response_header, response_header_add, ":");
    plumb_vec!(bld, cfg, remove_request_header, request_header_remove);
    plumb_vec!(bld, cfg, remove_response_header, response_header_remove);
    plumb_vec!(bld, cfg, basic_auth, basic_auth, ":");
    plumb_vec!(bld, cfg, allow_user_agent, allow_user_agent);
    plumb_vec!(bld, cfg, deny_user_agent, deny_user_agent);
    // circuit breaker
    if let Some(circuit_breaker) = cfg.circuit_breaker {
        bld.circuit_breaker(circuit_breaker);
    }
    // oauth
    if let Some(ref provider) = cfg.oauth_provider {
        bld.oauth(
            provider.clone(),
            cfg.oauth_allow_emails.clone(),
            cfg.oauth_allow_domains.clone(),
            cfg.oauth_scopes.clone(),
            cfg.oauth_client_id.clone(),
            cfg.oauth_client_secret.clone(),
        );
    }
    // oidc
    if let Some(ref issuer_url) = cfg.oidc_issuer_url {
        if cfg.oidc_client_id.is_none() {
            return Err(napi_err("Missing client id for oidc"));
        }
        if cfg.oidc_client_secret.is_none() {
            return Err(napi_err("Missing client secret for oidc"));
        }
        bld.oidc(
            issuer_url.clone(),
            cfg.oidc_client_id.clone().unwrap(),
            cfg.oidc_client_secret.clone().unwrap(),
            cfg.oidc_allow_emails.clone(),
            cfg.oidc_allow_domains.clone(),
            cfg.oidc_scopes.clone(),
        );
    }
    // webhook verification
    if let Some(ref provider) = cfg.verify_webhook_provider {
        if let Some(ref secret) = cfg.verify_webhook_secret {
            bld.webhook_verification(provider.clone(), secret.clone());
        } else {
            return Err(napi_err("Missing secret for webhook verification"));
        }
    }
    Ok(bld.listen(None).await?.id())
}

/// TCP Listener configuration
async fn tcp_endpoint(session: &Session, cfg: &Config) -> Result<String> {
    let mut bld = session.tcp_endpoint();
    config_common!(bld, cfg);
    plumb!(bld, cfg, remote_addr);
    Ok(bld.listen(None).await?.id())
}

/// TLS Listener configuration
async fn tls_endpoint(session: &Session, cfg: &Config) -> Result<String> {
    let mut bld = session.tls_endpoint();
    config_common!(bld, cfg);
    plumb!(bld, cfg, domain, hostname); // synonym for domain
    plumb!(bld, cfg, domain);
    plumb_vec!(bld, cfg, mutual_tlsca, mutual_tls_cas, vecu8);
    if let Some(ref crt) = cfg.crt {
        if let Some(ref key) = cfg.key {
            bld.termination(
                Uint8Array::new(crt.as_bytes().to_vec()),
                Uint8Array::new(key.as_bytes().to_vec()),
            );
        } else {
            return Err(napi_err("Missing key for tls termination"));
        }
    }
    Ok(bld.listen(None).await?.id())
}

/// Labeled Listener configuration
async fn labeled_listener(session: &Session, cfg: &Config) -> Result<String> {
    let mut bld = session.labeled_listener();
    plumb!(bld, cfg, metadata);
    plumb_vec!(bld, cfg, label, labels, ":");
    Ok(bld.listen(None).await?.id())
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

/// Warn about unused configuration values
fn warn_unused(config: &Config) {
    if config.bin_path.is_some() {
        warn!("bin_path is unused");
    }
    if config.config_path.is_some() {
        warn!("config_path is unused");
    }
    if config.host_header.is_some() {
        warn!("host_header is unused");
    }
    if config.inspect.is_some() {
        warn!("inspect is unused");
    }
    if config.name.is_some() {
        warn!("name is unused");
    }
    if config.region.is_some() {
        warn!("region is unused");
    }
    if let Some(ref schemes) = config.schemes {
        if schemes.len() > 1 {
            warn!("Multiple schemes set, only last one will be used");
        }
    }
    if config.subdomain.is_some() {
        warn!("subdomain is unused");
    }
    if config.terminate_at.is_some() {
        warn!("terminate_at is unused");
    }
    if config.web_addr.is_some() {
        warn!("web_addr is unused");
    }
}

/// Close a listener with the given url, or all listeners if no url is defined.
#[napi]
#[allow(dead_code)]
pub async fn disconnect(url: Option<String>) -> Result<()> {
    listener::close_url(url.clone()).await?;

    // if closing every listener, remove any stored session
    if url.as_ref().is_none() {
        SESSION.lock().await.take();
    }

    Ok(())
}

/// Close all listeners.
#[napi]
#[allow(dead_code)]
pub async fn kill() -> Result<()> {
    disconnect(None).await
}
