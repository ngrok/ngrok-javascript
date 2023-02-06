use std::time::Duration;

use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    session::SessionBuilder,
    Session,
};
use tracing::debug;
use tracing_subscriber::{
    self,
    fmt::format::FmtSpan,
};

use crate::tunnel_builder::{
    NgrokHttpTunnelBuilder,
    NgrokLabeledTunnelBuilder,
    NgrokTcpTunnelBuilder,
    NgrokTlsTunnelBuilder,
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

    /// Authenticate the ngrok session with the given authtoken.
    #[napi]
    pub fn authtoken(&mut self, authtoken: String) -> &Self {
        // can't put lifetimes or generics on napi structs, which limits our options.
        // there is a Reference which can force static lifetime, but haven't figured
        // out a way to make this actually helpful. so send in the clones.
        // https://napi.rs/docs/concepts/reference
        self.raw_builder = self.raw_builder.clone().authtoken(authtoken);
        self
    }

    /// Authenticate using the authtoken in the `NGROK_AUTHTOKEN` environment
    /// variable.
    #[napi]
    pub fn authtoken_from_env(&mut self) -> &Self {
        self.raw_builder = self.raw_builder.clone().authtoken_from_env();
        self
    }

    /// Set the heartbeat interval for the session.
    /// This value determines how often we send application level
    /// heartbeats to the server go check connection liveness.
    #[napi]
    pub fn heartbeat_interval(&mut self, heartbeat_interval: u32) -> &Self {
        self.raw_builder = self
            .raw_builder
            .clone()
            .heartbeat_interval(Duration::new(heartbeat_interval.into(), 0));
        self
    }

    /// Set the heartbeat tolerance for the session.
    /// If the session's heartbeats are outside of their interval by this duration,
    /// the server will assume the session is dead and close it.
    #[napi]
    pub fn heartbeat_tolerance(&mut self, heartbeat_tolerance: u32) -> &Self {
        self.raw_builder = self
            .raw_builder
            .clone()
            .heartbeat_tolerance(Duration::new(heartbeat_tolerance.into(), 0));
        self
    }

    /// Use the provided opaque metadata string for this session.
    /// Viewable from the ngrok dashboard or API.
    #[napi]
    pub fn metadata(&mut self, metadata: String) -> &Self {
        self.raw_builder = self.raw_builder.clone().metadata(metadata);
        self
    }

    /// Connect to the provided ngrok server address.
    #[napi]
    pub fn server_addr(&mut self, addr: String) -> &Self {
        self.raw_builder = self.raw_builder.clone().server_addr(addr).clone();
        self
    }

    // Omitting these configurations:
    // tls_config(&mut self, config: rustls::ClientConfig)
    // with_connect_callback(&mut self, callback: ConnectCallback)

    /// Attempt to establish an ngrok session using the current configuration.
    #[napi]
    pub async fn connect(&self) -> Result<NgrokSession> {
        self.raw_builder
            .connect()
            .await
            .map(|s| NgrokSession { raw_session: s })
            .map_err(|e| {
                Error::new(
                    Status::GenericFailure,
                    format!("failed to connect session, {e:?}"),
                )
            })
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
        NgrokHttpTunnelBuilder::new(self.raw_session.http_endpoint())
    }

    /// Start building a tunnel backing a TCP endpoint.
    #[napi]
    pub fn tcp_endpoint(&self) -> NgrokTcpTunnelBuilder {
        NgrokTcpTunnelBuilder::new(self.raw_session.tcp_endpoint())
    }

    /// Start building a tunnel backing a TLS endpoint.
    #[napi]
    pub fn tls_endpoint(&self) -> NgrokTlsTunnelBuilder {
        NgrokTlsTunnelBuilder::new(self.raw_session.tls_endpoint())
    }

    /// Start building a labeled tunnel.
    #[napi]
    pub fn labeled_tunnel(&self) -> NgrokLabeledTunnelBuilder {
        NgrokLabeledTunnelBuilder::new(self.raw_session.labeled_tunnel())
    }
}

impl ObjectFinalize for NgrokSession {
    fn finalize(self, mut _env: Env) -> Result<()> {
        debug!("NgrokSession finalize");
        Ok(())
    }
}
