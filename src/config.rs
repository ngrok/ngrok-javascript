use napi_derive::napi;

/// Configuration object to pass to `ngrok.forward()`/`ngrok.connect()`.
///
/// This fork's `Agent`/`EndpointOptions` API has no per-protocol edge modules (basic
/// auth, OAuth/OIDC, webhook verification, circuit breaker, compression, CIDR
/// restrictions, header add/remove, mutual TLS, websocket conversion, user-agent
/// filters, labels, ...) -- express those with {@link Config.trafficPolicy} instead.
/// See https://ngrok.com/docs/traffic-policy/.
///
/// @group Functions
#[napi(object)]
#[derive(Default)]
pub struct Config {
    /// Port or network address. Defaults to 80.
    /// Examples: "80", "localhost:8080", "https://192.168.1.100:8443"
    /// NOTE: this fork's upstream dialer only ever dials plain TCP -- unix sockets and
    /// Windows named pipes are not supported (a `unix:`/`pipe:`-prefixed address will
    /// silently resolve to `localhost:80` rather than failing).
    #[napi(ts_type = "number|string")]
    pub addr: Option<String>,
    /// Configures the agent to authenticate with the provided authtoken. You
    /// can [find your existing authtoken] or [create a new one] in the ngrok
    /// dashboard.
    ///
    /// [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
    /// [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
    pub authtoken: Option<String>,
    /// Shortcut for calling [AgentBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi(js_name = "authtoken_from_env")]
    pub authtoken_from_env: Option<bool>,
    /// Sets the ingress configuration for this endpoint.
    /// Valid values: "public", "internal", "kubernetes"
    /// If not specified, the ngrok service will use its default binding configuration.
    pub binding: Option<String>,
    /// A human-readable description for this endpoint.
    pub description: Option<String>,
    /// The domain to request for this edge, any valid domain or hostname that you have
    /// previously registered with ngrok. If using a custom domain, this requires
    /// registering in the [ngrok dashboard] and setting a DNS CNAME value.
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
    pub domain: Option<String>,
    /// Force a new agent session connection to be made.
    #[napi(js_name = "force_new_session")]
    pub force_new_session: Option<bool>,
    /// The hostname for the endpoint to forward to.
    /// Only used if addr is not defined.
    pub host: Option<String>,
    /// Synonym for domain
    pub hostname: Option<String>,
    /// Endpoint-specific opaque metadata. Viewable via the API.
    pub metadata: Option<String>,
    /// The endpoint name. Viewable via the dashboard and API.
    pub name: Option<String>,
    /// Returns log messages from the ngrok library.
    #[napi(ts_type = "(data: string) => void")]
    pub on_log_event: Option<bool>,
    /// 'closed' - connection is lost, 'connected' - reconnected
    #[napi(ts_type = "(status: string) => void")]
    pub on_status_change: Option<bool>,
    /// Enable endpoint pooling: multiple endpoints sharing the same url/binding will
    /// have traffic load-balanced across them instead of the bind failing.
    #[napi(js_name = "pooling_enabled")]
    pub pooling_enabled: Option<bool>,
    /// The port for the endpoint to forward to.
    /// Only used if addr is not defined.
    pub port: Option<u32>,
    /// The type of endpoint to use, one of http|tcp|tls, defaults to http.
    pub proto: Option<String>,
    /// The version of PROXY protocol to use when the agent connects to the upstream:
    /// "1", "2", or unset for none.
    #[napi(js_name = "proxy_proto")]
    pub proxy_proto: Option<String>,
    /// The TCP address to request for this edge.
    /// These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
    /// Only used if proto is "tcp".
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
    #[napi(js_name = "remote_addr")]
    pub remote_addr: Option<String>,
    /// Configures a custom CA certificate used to connect to the ngrok service while
    /// establishing the agent session. Use this option only if you are connecting
    /// through a man-in-the-middle or deep packet inspection proxy.
    #[napi(js_name = "session_ca_cert")]
    pub session_ca_cert: Option<String>,
    /// Configures the opaque, machine-readable metadata string for this agent's
    /// session. Metadata is made available to you in the ngrok dashboard and the
    /// Agents API resource.
    #[napi(js_name = "session_metadata")]
    pub session_metadata: Option<String>,
    /// Configures the network address to dial to connect to the ngrok service.
    /// Use this option only if you are connecting to a custom agent ingress.
    #[napi(js_name = "connect_url")]
    pub connect_url: Option<String>,
    /// The Traffic Policy document (YAML or JSON) to evaluate at the ngrok edge. This
    /// is the replacement for the old basic auth/OAuth/OIDC/webhook verification/
    /// circuit breaker/compression/CIDR restriction/header modification/etc. fields.
    /// See https://ngrok.com/docs/traffic-policy/.
    #[napi(js_name = "traffic_policy")]
    pub traffic_policy: Option<String>,
    /// Protocol hint for the upstream connection, e.g. "http1" or "http2".
    #[napi(js_name = "upstream_protocol")]
    pub upstream_protocol: Option<String>,
    /// Whether to verify the upstream's TLS certificate. Set to `false` to allow
    /// forwarding to a local HTTPS server with a self-signed certificate.
    #[napi(js_name = "verify_upstream_tls")]
    pub verify_upstream_tls: Option<bool>,
}
