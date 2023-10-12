use napi_derive::napi;

/// Configuration object to pass to ngrok.connect()
///
/// @group Functions
#[napi(object)]
#[derive(Default)]
pub struct Config {
    /// Port, network address, or named pipe. Defaults to 80.
    /// Examples: "80", "localhost:8080", "unix:/tmp/my.sock", "pipe://./my-pipe"
    #[napi(ts_type = "number|string")]
    pub addr: Option<String>,
    // Synonym for basic_auth
    #[napi(ts_type = "string|Array<string>")]
    pub auth: Option<Vec<String>>,
    /// Configures the session to authenticate with the provided authtoken. You
    /// can [find your existing authtoken] or [create a new one] in the ngrok
    /// dashboard.
    ///
    /// See the [authtoken parameter in the ngrok docs] for additional details.
    ///
    /// [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
    /// [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
    /// [authtoken parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#authtoken
    pub authtoken: Option<String>,
    /// Shortcut for calling [SessionBuilder::authtoken] with the value of the
    /// NGROK_AUTHTOKEN environment variable.
    #[napi(js_name = "authtoken_from_env")]
    pub authtoken_from_env: Option<bool>,
    /// Credentials for basic authentication, with username and password colon separated.
    #[napi(js_name = "basic_auth", ts_type = "string|Array<string>")]
    pub basic_auth: Option<Vec<String>>,
    /// Unused, will warn and be ignored
    pub bin_path: Option<String>,
    /// Reject requests when 5XX responses exceed this ratio.
    /// Disabled when 0.
    /// See [Circuit Breaker] in the ngrok docs for additional details.
    ///
    /// [Circuit Breaker]: https://ngrok.com/docs/cloud-edge/modules/circuit-breaker/
    #[napi(js_name = "circuit_breaker")]
    pub circuit_breaker: Option<f64>,
    /// Enable gzip compression for HTTP responses.
    /// See [Compression] in the ngrok docs for additional details.
    ///
    /// [Compression]: https://ngrok.com/docs/cloud-edge/modules/compression/
    pub compression: Option<bool>,
    /// Unused, will warn and be ignored
    pub config_path: Option<String>,
    /// The certificate to use for TLS termination at the ngrok edge in PEM format.
    /// Only used if "proto" is "tls".
    /// See [TLS Termination] in the ngrok docs for additional details.
    ///
    /// [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
    pub crt: Option<String>,
    /// The domain to request for this edge, any valid domain or hostname that you have
    /// previously registered with ngrok. If using a custom domain, this requires
    /// registering in the [ngrok dashboard] and setting a DNS CNAME value.
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
    pub domain: Option<String>,
    /// Returns a human-readable string presented in the ngrok dashboard
    /// and the API.
    #[napi(js_name = "forwards_to")]
    pub forwards_to: Option<String>,
    /// Unused, will warn and be ignored
    #[napi(js_name = "host_header")]
    pub host_header: Option<String>,
    /// The hostname for the listener to forward to.
    /// Only used if addr is not defined.
    pub host: Option<String>,
    /// Synonym for domain
    pub hostname: Option<String>,
    /// Unused, will warn and be ignored
    pub inspect: Option<String>,
    /// Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
    #[napi(
        js_name = "ip_restriction_allow_cidrs",
        ts_type = "string|Array<string>"
    )]
    pub allow_cidr: Option<Vec<String>>,
    /// Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
    #[napi(
        js_name = "ip_restriction_deny_cidrs",
        ts_type = "string|Array<string>"
    )]
    pub deny_cidr: Option<Vec<String>>,

    /// A set of regular expressions used to match User-Agents that will be allowed.
    /// On request, the User Agent Filter module will check the incoming User-Agent header value
    /// against the list of defined allow and deny regular expression rules.
    /// See `User Agent Filter`_ in the ngrok docs for additional details.
    ///
    /// .. _User Agent Filter: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
    #[napi(js_name = "allow_user_agent", ts_type = "string|Array<string>")]
    pub allow_user_agent: Option<Vec<String>>,
    /// A set of regular expressions used to match User-Agents that will be denied.
    /// On request, the User Agent Filter module will check the incoming User-Agent header value
    /// against the list of defined allow and deny regular expression rules.
    /// See `User Agent Filter`_ in the ngrok docs for additional details.
    ///
    /// .. _User Agent Filter: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
    #[napi(js_name = "deny_user_agent", ts_type = "string|Array<string>")]
    pub deny_user_agent: Option<Vec<String>>,

    /// The certificate to use for TLS termination at the ngrok edge in PEM format.
    /// Only used if "proto" is "tls".
    /// See [TLS Termination] in the ngrok docs for additional details.
    ///
    /// [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
    pub key: Option<String>,
    /// Add label, value pairs for this listener, colon separated.
    #[napi(ts_type = "string|Array<string>")]
    pub labels: Option<Vec<String>>,
    /// Listener-specific opaque metadata. Viewable via the API.
    pub metadata: Option<String>,
    /// Certificates to use for client authentication at the ngrok edge.
    /// Only used if "proto" is "tls" or "http".
    /// See [Mutual TLS] in the ngrok docs for additional details.
    ///
    /// [Mutual TLS]: https://ngrok.com/docs/cloud-edge/modules/mutual-tls/
    #[napi(js_name = "mutual_tls_cas", ts_type = "string|Array<string>")]
    pub mutual_tls_cas: Option<Vec<String>>,
    /// Unused, will warn and be ignored
    pub name: Option<String>,

    /// OAuth configuration of domains to allow.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_allow_domains", ts_type = "string|Array<string>")]
    pub oauth_allow_domains: Option<Vec<String>>,
    /// OAuth configuration of email addresses to allow.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_allow_emails", ts_type = "string|Array<string>")]
    pub oauth_allow_emails: Option<Vec<String>>,
    /// OAuth configuration of scopes.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_scopes", ts_type = "string|Array<string>")]
    pub oauth_scopes: Option<Vec<String>>,
    /// OAuth configuration of the provider, e.g. "google".
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_provider")]
    pub oauth_provider: Option<String>,
    /// OAuth configuration of client ID. Required for scopes.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_client_id")]
    pub oauth_client_id: Option<String>,
    /// OAuth configuration of client secret. Required for scopes.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi(js_name = "oauth_client_secret")]
    pub oauth_client_secret: Option<String>,

    /// OIDC configuration of client ID.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_client_id")]
    pub oidc_client_id: Option<String>,
    /// OIDC configuration of client secret.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_client_secret")]
    pub oidc_client_secret: Option<String>,
    /// OIDC configuration of scopes.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_scopes", ts_type = "string|Array<string>")]
    pub oidc_scopes: Option<Vec<String>>,
    /// OIDC configuration of the issuer URL.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_issuer_url")]
    pub oidc_issuer_url: Option<String>,
    /// OIDC configuration of domains to allow.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_allow_domains", ts_type = "string|Array<string>")]
    pub oidc_allow_domains: Option<Vec<String>>,
    /// OIDC configuration of email addresses to allow.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi(js_name = "oidc_allow_emails", ts_type = "string|Array<string>")]
    pub oidc_allow_emails: Option<Vec<String>>,

    /// Returns log messages from the ngrok library.
    #[napi(ts_type = "(data: string) => void")]
    pub on_log_event: Option<bool>,
    /// 'closed' - connection is lost, 'connected' - reconnected
    #[napi(ts_type = "(status: string) => void")]
    pub on_status_change: Option<bool>,
    /// The port for the listener to forward to.
    /// Only used if addr is not defined.
    pub port: Option<u32>,
    /// The type of listener to use, one of http|tcp|tls|labeled, defaults to http.
    pub proto: Option<String>,
    /// The version of PROXY protocol to use with this listener "1", "2", or "" if not using.
    #[napi(js_name = "proxy_proto")]
    pub proxy_proto: Option<String>,
    /// Adds a header to all requests to this edge.
    /// See [Request Headers] in the ngrok docs for additional details.
    ///
    /// [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
    #[napi(js_name = "request_header_add", ts_type = "string|Array<string>")]
    pub request_header_add: Option<Vec<String>>,
    /// Removes a header from requests to this edge.
    /// See [Request Headers] in the ngrok docs for additional details.
    ///
    /// [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
    #[napi(js_name = "request_header_remove", ts_type = "string|Array<string>")]
    pub request_header_remove: Option<Vec<String>>,
    /// Adds a header to all responses coming from this edge.
    /// See [Response Headers] in the ngrok docs for additional details.
    ///
    /// [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
    #[napi(js_name = "response_header_add", ts_type = "string|Array<string>")]
    pub response_header_add: Option<Vec<String>>,
    /// Removes a header from responses from this edge.
    /// See [Response Headers] in the ngrok docs for additional details.
    ///
    /// [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
    #[napi(js_name = "response_header_remove", ts_type = "string|Array<string>")]
    pub response_header_remove: Option<Vec<String>>,
    /// Unused, will warn and be ignored
    pub region: Option<String>,
    /// The TCP address to request for this edge.
    /// These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
    /// Only used if proto is "tcp".
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
    #[napi(js_name = "remote_addr")]
    pub remote_addr: Option<String>,
    /// The scheme that this edge should use.
    /// "HTTPS" or "HTTP", defaults to "HTTPS".
    /// If multiple are given only the last one is used.
    #[napi(ts_type = "string|Array<string>")]
    pub schemes: Option<Vec<String>>,
    /// Configures the opaque, machine-readable metadata string for this session.
    /// Metadata is made available to you in the ngrok dashboard and the Agents API
    /// resource. It is a useful way to allow you to uniquely identify sessions. We
    /// suggest encoding the value in a structured format like JSON.
    ///
    /// See the [metdata parameter in the ngrok docs] for additional details.
    ///
    /// [metdata parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#metadata
    #[napi(js_name = "session_metadata")]
    pub session_metadata: Option<String>,
    /// Unused, use domain instead, will warn and be ignored
    pub subdomain: Option<String>,
    /// Unused, will warn and be ignored
    #[napi(js_name = "terminate_at")]
    pub terminate_at: Option<String>,
    /// WebhookVerification configuration, the provider to use.
    /// See [Webhook Verification] in the ngrok docs for additional details.
    ///
    /// [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
    #[napi(js_name = "verify_webhook_provider")]
    pub verify_webhook_provider: Option<String>,
    /// WebhookVerification configuration, the secret to use.
    /// See [Webhook Verification] in the ngrok docs for additional details.
    ///
    /// [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
    #[napi(js_name = "verify_webhook_secret")]
    pub verify_webhook_secret: Option<String>,
    /// Unused, will warn and be ignored
    #[napi(js_name = "web_addr")]
    pub web_addr: Option<String>,
    /// Convert incoming websocket connections to TCP-like streams.
    #[napi(js_name = "websocket_tcp_converter")]
    pub websocket_tcp_converter: Option<bool>,
}
