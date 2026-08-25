use std::sync::Arc;

use lazy_static::lazy_static;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    Agent,
    EndpointOptions,
    ProxyProtoVersion,
    Upstream,
};
use parking_lot::Mutex;
use regex::Regex;
use tracing::debug;

use crate::{
    endpoint::{
        Endpoint,
        TCP_PREFIX,
        UNIX_PREFIX,
    },
    napi_err,
    napi_ngrok_err,
};

#[derive(Default, Clone)]
struct BuilderState {
    url: Option<String>,
    name: Option<String>,
    description: Option<String>,
    metadata: Option<String>,
    traffic_policy: Option<String>,
    pooling_enabled: bool,
    bindings: Vec<String>,
}

/// Options for the upstream address an endpoint forwards to. See
/// {@link EndpointBuilder.forward}.
///
/// @group Agent
#[napi(object)]
#[derive(Default, Clone)]
pub struct UpstreamOptions {
    /// Protocol hint for the upstream connection, e.g. "http1" or "http2".
    pub protocol: Option<String>,
    /// Set to `false` to skip certificate verification when connecting to an HTTPS
    /// upstream (e.g. a local dev server with a self-signed certificate).
    pub verify_upstream_tls: Option<bool>,
    /// The version of the PROXY protocol to use when the agent connects to the
    /// upstream: "1", "2", or unset for none.
    pub proxy_proto: Option<String>,
}

/// A builder for an ngrok endpoint.
///
/// This fork's `Agent` API collapses the old per-protocol builders (`HttpListenerBuilder`,
/// `TcpListenerBuilder`, `TlsListenerBuilder`, `LabeledListenerBuilder`) into a single
/// `EndpointOptions` type with only `url`/`name`/`description`/`metadata`/`trafficPolicy`/
/// `poolingEnabled`/`bindings`. The old fine-grained edge modules (basic auth, OAuth/OIDC,
/// webhook verification, circuit breaker, compression, CIDR restrictions, header add/remove,
/// mutual TLS, websocket conversion, user-agent filters, labels, ...) have no
/// builder-method equivalent here -- express them as a {@link EndpointBuilder.trafficPolicy}
/// document instead. See https://ngrok.com/docs/traffic-policy/.
///
/// @group Agent
#[napi(custom_finalize)]
#[allow(dead_code)]
pub struct EndpointBuilder {
    agent: Agent,
    state: Arc<Mutex<BuilderState>>,
    default_scheme: &'static str,
}

#[napi]
#[allow(dead_code)]
impl EndpointBuilder {
    pub(crate) fn new(agent: Agent, default_scheme: &'static str) -> Self {
        EndpointBuilder {
            agent,
            state: Arc::new(Mutex::new(BuilderState::default())),
            default_scheme,
        }
    }

    fn build_options(&self) -> EndpointOptions {
        let s = self.state.lock().clone();
        let mut b = EndpointOptions::builder();
        if let Some(url) = s.url {
            b = b.url(url);
        }
        if let Some(name) = s.name {
            b = b.name(name);
        }
        if let Some(description) = s.description {
            b = b.description(description);
        }
        if let Some(metadata) = s.metadata {
            b = b.metadata(metadata);
        }
        if let Some(traffic_policy) = s.traffic_policy {
            b = b.traffic_policy(traffic_policy);
        }
        b = b.pooling_enabled(s.pooling_enabled);
        if !s.bindings.is_empty() {
            b = b.bindings(s.bindings);
        }
        b.build()
    }

    /// The full URL for this endpoint (scheme determines protocol), e.g.
    /// "https://my-domain.ngrok.app" or "tcp://2.tcp.ngrok.io:21746".
    #[napi]
    pub fn url(&self, url: String) -> &Self {
        self.state.lock().url = Some(url);
        self
    }

    /// Convenience for HTTP/TLS endpoints: sets the url to `{scheme}://{domain}` using
    /// this builder's default scheme.
    #[napi]
    pub fn domain(&self, domain: String) -> &Self {
        self.state.lock().url = Some(format!("{}://{}", self.default_scheme, domain));
        self
    }

    /// Convenience for TCP endpoints: sets the url to `tcp://{remote_addr}`.
    #[napi]
    pub fn remote_addr(&self, remote_addr: String) -> &Self {
        self.state.lock().url = Some(format!("tcp://{remote_addr}"));
        self
    }

    /// The endpoint name. Viewable via the dashboard and API.
    #[napi]
    pub fn name(&self, name: String) -> &Self {
        self.state.lock().name = Some(name);
        self
    }

    /// A human-readable description for this endpoint.
    #[napi]
    pub fn description(&self, description: String) -> &Self {
        self.state.lock().description = Some(description);
        self
    }

    /// Endpoint-specific opaque metadata. Viewable via the API.
    #[napi]
    pub fn metadata(&self, metadata: String) -> &Self {
        self.state.lock().metadata = Some(metadata);
        self
    }

    /// The Traffic Policy YAML/JSON document to evaluate at the ngrok edge. This is the
    /// replacement for the old basic auth/OAuth/OIDC/webhook verification/circuit
    /// breaker/compression/CIDR restriction/header modification/etc. builder methods.
    /// See https://ngrok.com/docs/traffic-policy/.
    #[napi]
    pub fn traffic_policy(&self, traffic_policy: String) -> &Self {
        self.state.lock().traffic_policy = Some(traffic_policy);
        self
    }

    /// Enable endpoint pooling: multiple endpoints sharing the same url/binding will
    /// have traffic load-balanced across them instead of the bind failing.
    #[napi]
    pub fn pooling_enabled(&self, pooling_enabled: bool) -> &Self {
        self.state.lock().pooling_enabled = pooling_enabled;
        self
    }

    /// Sets the ingress configuration for this endpoint.
    /// Valid values: "public", "internal", "kubernetes"
    #[napi]
    pub fn binding(&self, binding: String) -> &Self {
        self.state.lock().bindings = vec![binding];
        self
    }

    /// Begin listening for new connections on this endpoint without forwarding them
    /// anywhere. NOTE: this fork's `Agent` API has no way to attach an upstream to an
    /// endpoint after it starts listening, and this package does not currently expose
    /// raw connection accept to JavaScript -- {@link forward} is almost always what
    /// you want instead.
    #[napi]
    pub async fn listen(&self) -> Result<Endpoint> {
        let opts = self.build_options();
        let raw = self
            .agent
            .listen(opts)
            .await
            .map_err(|e| napi_ngrok_err("failed to start endpoint", &e))?;
        Ok(Endpoint::new_listener(self.agent.clone(), raw).await)
    }

    /// Begin listening for new connections on this endpoint and forwarding them to the
    /// given upstream address. This can be a port number, a `host:port`, or an `http(s)://`
    /// URL. NOTE: unix sockets and Windows named pipes are not supported -- see
    /// {@link build_upstream} in this module.
    #[napi]
    pub async fn forward(
        &self,
        addr: String,
        upstream: Option<UpstreamOptions>,
    ) -> Result<Endpoint> {
        let opts = self.build_options();
        let upstream = build_upstream(&addr, upstream)?;
        let raw = self
            .agent
            .forward(upstream, opts)
            .await
            .map_err(|e| napi_ngrok_err("failed to start endpoint", &e))?;
        Ok(Endpoint::new_forwarder(self.agent.clone(), raw).await)
    }

    /// Begin listening for new connections on this endpoint and forwarding them to the
    /// given server. Implemented in the JavaScript wrapper.
    #[napi(ts_args_type = "server: any")]
    pub async fn serve(&self, server: String) -> Result<Endpoint> {
        Err(napi_err(format!("serve implemented in wrapper, {server}")))
    }
}

impl ObjectFinalize for EndpointBuilder {
    fn finalize(self, _env: Env) -> Result<()> {
        debug!("EndpointBuilder finalize");
        Ok(())
    }
}

/// Build an `Upstream` from a forward address and options, applying the same
/// unix-socket/TCP prefix inference the old API used.
///
/// NOTE: this fork's `Upstream`/dialer only resolves and dials plain TCP `host:port` --
/// it has no unix-domain-socket support at all, so a `unix:`-prefixed address is
/// rejected up front rather than silently resolving to the wrong destination
/// (`localhost:80`).
fn build_upstream(addr: &str, opts: Option<UpstreamOptions>) -> Result<Upstream> {
    let mut addr = addr.to_string();
    lazy_static! {
        static ref RE: Regex = Regex::new(r"^[a-z0-9\-\.]+:\d+$").unwrap();
    }
    if !addr.contains(':') || RE.find(&addr).is_some() {
        if addr.contains('/') {
            addr = format!("{UNIX_PREFIX}{addr}");
        } else {
            addr = format!("{TCP_PREFIX}{addr}");
        }
    }

    if addr.starts_with(UNIX_PREFIX) {
        return Err(napi_err(
            "unix domain socket upstreams are not supported: this fork's upstream \
             dialer only resolves plain TCP host:port addresses"
                .to_string(),
        ));
    }

    let mut upstream = Upstream::new(addr);
    let opts = opts.unwrap_or_default();

    if let Some(protocol) = opts.protocol {
        upstream = upstream.protocol(protocol);
    }
    if let Some(proxy_proto) = opts.proxy_proto {
        let version = match proxy_proto.as_str() {
            "1" => ProxyProtoVersion::V1,
            "2" => ProxyProtoVersion::V2,
            "" => ProxyProtoVersion::None,
            other => {
                return Err(napi_err(format!(
                    "unknown proxy protocol version: {other:?}"
                )))
            }
        };
        upstream = upstream.proxy_proto(version);
    }
    if opts.verify_upstream_tls == Some(false) {
        upstream = upstream.tls_config(insecure_client_config());
    }

    Ok(upstream)
}

/// A `rustls::ClientConfig` that skips upstream certificate verification entirely, for
/// forwarding to local/dev HTTPS backends with self-signed certificates.
fn insecure_client_config() -> rustls::ClientConfig {
    rustls::ClientConfig::builder_with_provider(Arc::new(rustls::crypto::ring::default_provider()))
        .with_safe_default_protocol_versions()
        .expect("rustls default protocol versions are always valid")
        .dangerous()
        .with_custom_certificate_verifier(Arc::new(NoCertVerification))
        .with_no_client_auth()
}

#[derive(Debug)]
struct NoCertVerification;

impl rustls::client::danger::ServerCertVerifier for NoCertVerification {
    fn verify_server_cert(
        &self,
        _end_entity: &rustls::pki_types::CertificateDer<'_>,
        _intermediates: &[rustls::pki_types::CertificateDer<'_>],
        _server_name: &rustls::pki_types::ServerName<'_>,
        _ocsp_response: &[u8],
        _now: rustls::pki_types::UnixTime,
    ) -> std::result::Result<rustls::client::danger::ServerCertVerified, rustls::Error> {
        Ok(rustls::client::danger::ServerCertVerified::assertion())
    }

    fn verify_tls12_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> std::result::Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn verify_tls13_signature(
        &self,
        _message: &[u8],
        _cert: &rustls::pki_types::CertificateDer<'_>,
        _dss: &rustls::DigitallySignedStruct,
    ) -> std::result::Result<rustls::client::danger::HandshakeSignatureValid, rustls::Error> {
        Ok(rustls::client::danger::HandshakeSignatureValid::assertion())
    }

    fn supported_verify_schemes(&self) -> Vec<rustls::SignatureScheme> {
        rustls::crypto::ring::default_provider()
            .signature_verification_algorithms
            .supported_schemes()
    }
}
