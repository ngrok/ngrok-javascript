/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

/**
 * Configuration object to pass to ngrok.forward()
 *
 * @group Functions
 */
export interface Config {
  /**
   * Port, network address, url, or named pipe. Defaults to 80.
   * Examples: "80", "localhost:8080", "https://192.168.1.100:8443", "unix:/tmp/my.sock", "pipe://./my-pipe"
   */
  addr?: number|string
  /** The L7 application protocol to use for this edge, e.g. "http2" or "http1". */
  app_protocol?: string
  auth?: string|Array<string>
  /**
   * Configures the session to authenticate with the provided authtoken. You
   * can [find your existing authtoken] or [create a new one] in the ngrok
   * dashboard.
   *
   * See the [authtoken parameter in the ngrok docs] for additional details.
   *
   * [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
   * [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
   * [authtoken parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#authtoken
   */
  authtoken?: string
  /**
   * Shortcut for calling [SessionBuilder::authtoken] with the value of the
   * NGROK_AUTHTOKEN environment variable.
   */
  authtoken_from_env?: boolean
  /** Credentials for basic authentication, with username and password colon separated. */
  basic_auth?: string|Array<string>
  /** Unused, will warn and be ignored */
  binPath?: string
  /**
   * Reject requests when 5XX responses exceed this ratio.
   * Disabled when 0.
   * See [Circuit Breaker] in the ngrok docs for additional details.
   *
   * [Circuit Breaker]: https://ngrok.com/docs/cloud-edge/modules/circuit-breaker/
   */
  circuit_breaker?: number
  /**
   * Enable gzip compression for HTTP responses.
   * See [Compression] in the ngrok docs for additional details.
   *
   * [Compression]: https://ngrok.com/docs/cloud-edge/modules/compression/
   */
  compression?: boolean
  /** Unused, will warn and be ignored */
  configPath?: string
  /**
   * The certificate to use for TLS termination at the ngrok edge in PEM format.
   * Only used if "proto" is "tls".
   * See [TLS Termination] in the ngrok docs for additional details.
   *
   * [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
   */
  crt?: string
  /**
   * The domain to request for this edge, any valid domain or hostname that you have
   * previously registered with ngrok. If using a custom domain, this requires
   * registering in the [ngrok dashboard] and setting a DNS CNAME value.
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
   */
  domain?: string
  /**
   * Returns a human-readable string presented in the ngrok dashboard
   * and the API.
   */
  forwards_to?: string
  /** Unused, will warn and be ignored */
  host_header?: string
  /**
   * The hostname for the listener to forward to.
   * Only used if addr is not defined.
   */
  host?: string
  /** Synonym for domain */
  hostname?: string
  /** Unused, will warn and be ignored */
  inspect?: string
  /** Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges. */
  ip_restriction_allow_cidrs?: string|Array<string>
  /** Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges. */
  ip_restriction_deny_cidrs?: string|Array<string>
  /**
   * A set of regular expressions used to match User-Agents that will be allowed.
   * On request, the User Agent Filter module will check the incoming User-Agent header value
   * against the list of defined allow and deny regular expression rules.
   * See `User Agent Filter`_ in the ngrok docs for additional details.
   *
   * .. _User Agent Filter: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
   */
  allow_user_agent?: string|Array<string>
  /**
   * A set of regular expressions used to match User-Agents that will be denied.
   * On request, the User Agent Filter module will check the incoming User-Agent header value
   * against the list of defined allow and deny regular expression rules.
   * See `User Agent Filter`_ in the ngrok docs for additional details.
   *
   * .. _User Agent Filter: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
   */
  deny_user_agent?: string|Array<string>
  /**
   * The certificate to use for TLS termination at the ngrok edge in PEM format.
   * Only used if "proto" is "tls".
   * See [TLS Termination] in the ngrok docs for additional details.
   *
   * [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
   */
  key?: string
  /** Add label, value pairs for this listener, colon separated. */
  labels?: string|Array<string>
  /** Listener-specific opaque metadata. Viewable via the API. */
  metadata?: string
  /**
   * Certificates to use for client authentication at the ngrok edge.
   * Only used if "proto" is "tls" or "http".
   * See [Mutual TLS] in the ngrok docs for additional details.
   *
   * [Mutual TLS]: https://ngrok.com/docs/cloud-edge/modules/mutual-tls/
   */
  mutual_tls_cas?: string|Array<string>
  /** Unused, will warn and be ignored */
  name?: string
  /**
   * OAuth configuration of domains to allow.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_allow_domains?: string|Array<string>
  /**
   * OAuth configuration of email addresses to allow.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_allow_emails?: string|Array<string>
  /**
   * OAuth configuration of scopes.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_scopes?: string|Array<string>
  /**
   * OAuth configuration of the provider, e.g. "google".
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_provider?: string
  /**
   * OAuth configuration of client ID. Required for scopes.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_client_id?: string
  /**
   * OAuth configuration of client secret. Required for scopes.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_client_secret?: string
  /**
   * OIDC configuration of client ID.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_client_id?: string
  /**
   * OIDC configuration of client secret.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_client_secret?: string
  /**
   * OIDC configuration of scopes.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_scopes?: string|Array<string>
  /**
   * OIDC configuration of the issuer URL.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_issuer_url?: string
  /**
   * OIDC configuration of domains to allow.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_allow_domains?: string|Array<string>
  /**
   * OIDC configuration of email addresses to allow.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc_allow_emails?: string|Array<string>
  /** Returns log messages from the ngrok library. */
  onLogEvent?: (data: string) => void
  /** 'closed' - connection is lost, 'connected' - reconnected */
  onStatusChange?: (status: string) => void
  /** The Traffic Policy to use for this endpoint. */
  policy?: string
  /**
   * The port for the listener to forward to.
   * Only used if addr is not defined.
   */
  port?: number
  /** The type of listener to use, one of http|tcp|tls|labeled, defaults to http. */
  proto?: string
  /** The version of PROXY protocol to use with this listener "1", "2", or "" if not using. */
  proxy_proto?: string
  /**
   * Adds a header to all requests to this edge.
   * See [Request Headers] in the ngrok docs for additional details.
   *
   * [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
   */
  request_header_add?: string|Array<string>
  /**
   * Removes a header from requests to this edge.
   * See [Request Headers] in the ngrok docs for additional details.
   *
   * [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
   */
  request_header_remove?: string|Array<string>
  /**
   * Adds a header to all responses coming from this edge.
   * See [Response Headers] in the ngrok docs for additional details.
   *
   * [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
   */
  response_header_add?: string|Array<string>
  /**
   * Removes a header from responses from this edge.
   * See [Response Headers] in the ngrok docs for additional details.
   *
   * [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
   */
  response_header_remove?: string|Array<string>
  /** Unused, will warn and be ignored */
  region?: string
  /**
   * The TCP address to request for this edge.
   * These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
   * Only used if proto is "tcp".
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
   */
  remote_addr?: string
  /**
   * The scheme that this edge should use.
   * "HTTPS" or "HTTP", defaults to "HTTPS".
   * If multiple are given only the last one is used.
   */
  schemes?: string|Array<string>
  /**
   * Configures the opaque, machine-readable metadata string for this session.
   * Metadata is made available to you in the ngrok dashboard and the Agents API
   * resource. It is a useful way to allow you to uniquely identify sessions. We
   * suggest encoding the value in a structured format like JSON.
   *
   * See the [metdata parameter in the ngrok docs] for additional details.
   *
   * [metdata parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#metadata
   */
  session_metadata?: string
  /** Unused, use domain instead, will warn and be ignored */
  subdomain?: string
  /** Unused, will warn and be ignored */
  terminate_at?: string
  /** Whether to disable certificate verification for this listener */
  verify_upstream_tls?: boolean
  /**
   * WebhookVerification configuration, the provider to use.
   * See [Webhook Verification] in the ngrok docs for additional details.
   *
   * [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
   */
  verify_webhook_provider?: string
  /**
   * WebhookVerification configuration, the secret to use.
   * See [Webhook Verification] in the ngrok docs for additional details.
   *
   * [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
   */
  verify_webhook_secret?: string
  /** Unused, will warn and be ignored */
  web_addr?: string
  /** Convert incoming websocket connections to TCP-like streams. */
  websocket_tcp_converter?: boolean
}
/**
 * Alias for {@link forward}.
 *
 * See {@link forward} for the full set of options.
 */
export function connect(config: Config|string|number): Promise<Listener>
/**
 * Transform a json object configuration into a listener.
 * See {@link Config} for the full set of options.
 *
 * Examples:<br>
 * listener = await ngrok.forward("localhost:4242");<br>
 * listener = await ngrok.forward({addr: "https://localhost:8443", authtoken_from_env: true});<br>
 * listener = await ngrok.forward({addr: "unix:///path/to/unix.socket", basic_auth: "ngrok:online1line", authtoken_from_env: true});
 */
export function forward(config: Config|string|number): Promise<Listener>
/** Close a listener with the given url, or all listeners if no url is defined. */
export function disconnect(url?: string | undefined | null): Promise<void>
/** Close all listeners. */
export function kill(): Promise<void>
/** Retrieve a list of non-closed listeners, in no particular order. */
export function listeners(): Promise<Array<Listener>>
/** Retrieve listener using the id */
export function getListener(id: string): Promise<Listener | null>
/** Retrieve listener using the url */
export function getListenerByUrl(url: string): Promise<Listener | null>
/**
 * Register a callback function that will receive logging event information.
 * An absent callback will unregister an existing callback function.
 * The log level defaults to INFO, it can be set to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function loggingCallback(callback?: (level: string, target: string, message: string) => void, level?: string): void
/** Set the default auth token to use for any future sessions. */
export function authtoken(authtoken: string): Promise<void>
/**
 * An ngrok listener.
 *
 * @group Listener and Sessions
 */
export class Listener {
  /** The URL that this listener backs. */
  url(): string | null
  /** The protocol of the endpoint that this listener backs. */
  proto(): string | null
  /** The labels this listener was started with. */
  labels(): Record<string, string>
  /** Returns a listener's unique ID. */
  id(): string
  /**
   * Returns a human-readable string presented in the ngrok dashboard
   * and the API. Use the
   * {@link HttpListenerBuilder.forwardsTo | HttpListenerBuilder.forwardsTo},
   * {@link TcpListenerBuilder.forwardsTo | TcpListenerBuilder.forwardsTo},
   * etc. to set this value explicitly.
   *
   * To automatically forward connections, you can use
   * {@link HttpListenerBuilder.listenAndForward} or {@link HttpListenerBuilder.listenAndServe}
   * on the Listener Builder. These methods will also set this `forwardsTo` value.
   */
  forwardsTo(): string
  /** Returns the arbitrary metadata string for this listener. */
  metadata(): string
  /**
   * Forward incoming listener connections. This can be either a TCP address or a file socket path.
   * For file socket paths on Linux/Darwin, addr can be a unix domain socket path, e.g. "/tmp/ngrok.sock"
   *     On Windows, addr can be a named pipe, e.e. "\\\\.\\pipe\\an_ngrok_pipe
   */
  forward(addr: string): Promise<void>
  /** Wait for the forwarding task to exit. */
  join(): Promise<void>
  /**
   * Close the listener.
   *
   * This is an RPC call that must be `.await`ed.
   * It is equivalent to calling `Session::close_listener` with this
   * listener's ID.
   */
  close(): Promise<void>
}
/**
 *r" An ngrok listener backing an HTTP endpoint.
 *r"
 *r" @group Listener Builders
 */
export class HttpListenerBuilder {
  /**
   * The scheme that this edge should use.
   * "HTTPS" or "HTTP", defaults to "HTTPS".
   */
  scheme(scheme: string): this
  /** The L7 application protocol to use for this edge, e.g. "http2" or "http1". */
  appProtocol(appProtocol: string): this
  /**
   * The domain to request for this edge, any valid domain or hostname that you have
   * previously registered with ngrok. If using a custom domain, this requires
   * registering in the [ngrok dashboard] and setting a DNS CNAME value.
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
   */
  domain(domain: string): this
  /**
   * Certificates to use for client authentication at the ngrok edge.
   * See [Mutual TLS] in the ngrok docs for additional details.
   *
   * [Mutual TLS]: https://ngrok.com/docs/cloud-edge/modules/mutual-tls/
   */
  mutualTlsca(mutualTlsca: Uint8Array): this
  /**
   * Enable gzip compression for HTTP responses.
   * See [Compression] in the ngrok docs for additional details.
   *
   * [Compression]: https://ngrok.com/docs/cloud-edge/modules/compression/
   */
  compression(): this
  /** Convert incoming websocket connections to TCP-like streams. */
  websocketTcpConversion(): this
  /**
   * Reject requests when 5XX responses exceed this ratio.
   * Disabled when 0.
   * See [Circuit Breaker] in the ngrok docs for additional details.
   *
   * [Circuit Breaker]: https://ngrok.com/docs/cloud-edge/modules/circuit-breaker/
   */
  circuitBreaker(circuitBreaker: number): this
  /**
   * Adds a header to all requests to this edge.
   * See [Request Headers] in the ngrok docs for additional details.
   *
   * [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
   */
  requestHeader(name: string, value: string): this
  /**
   * Adds a header to all responses coming from this edge.
   * See [Response Headers] in the ngrok docs for additional details.
   *
   * [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
   */
  responseHeader(name: string, value: string): this
  /**
   * Removes a header from requests to this edge.
   * See [Request Headers] in the ngrok docs for additional details.
   *
   * [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
   */
  removeRequestHeader(name: string): this
  /**
   * Removes a header from responses from this edge.
   * See [Response Headers] in the ngrok docs for additional details.
   *
   * [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
   */
  removeResponseHeader(name: string): this
  /**
   * Credentials for basic authentication.
   * If not called, basic authentication is disabled.
   */
  basicAuth(username: string, password: string): this
  /**
   * A set of regular expressions used to match User-Agents that will be allowed.
   * On request, the User Agent Filter module will check the incoming User-Agent header value
   * against the list of defined allow and deny regular expression rules.
   * See [User Agent Filter] in the ngrok docs for additional details.
   *
   * .. [User Agent Filter]: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
   */
  allowUserAgent(regex: string): this
  /**
   * A set of regular expressions used to match User-Agents that will be denied.
   * On request, the User Agent Filter module will check the incoming User-Agent header value
   * against the list of defined allow and deny regular expression rules.
   * See [User Agent Filter] in the ngrok docs for additional details.
   *
   * .. [User Agent Filter]: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
   */
  denyUserAgent(regex: string): this
  /**
   * OAuth configuration.
   * If not called, OAuth is disabled.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth(provider: string, allowEmails?: Array<string> | undefined | null, allowDomains?: Array<string> | undefined | null, scopes?: Array<string> | undefined | null, clientId?: string | undefined | null, clientSecret?: string | undefined | null): this
  /**
   * OIDC configuration.
   * If not called, OIDC is disabled.
   * See [OpenID Connect] in the ngrok docs for additional details.
   *
   * [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
   */
  oidc(issuerUrl: string, clientId: string, clientSecret: string, allowEmails?: Array<string> | undefined | null, allowDomains?: Array<string> | undefined | null, scopes?: Array<string> | undefined | null): this
  /**
   * WebhookVerification configuration.
   * If not called, WebhookVerification is disabled.
   * See [Webhook Verification] in the ngrok docs for additional details.
   *
   * [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
   */
  webhookVerification(provider: string, secret: string): this
  /** Listener-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Whether to disable certificate verification for this listener. */
  verifyUpstreamTls(verifyUpstreamTls: boolean): this
  /** Begin listening for new connections on this listener. */
  listen(bind?: boolean | undefined | null): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given url.
   * This method will also set the `forwardsTo` value.
   */
  listenAndForward(toUrl: string): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given server.
   * This method will also set the `forwardsTo` value.
   */
  listenAndServe(server: any): Promise<Listener>
  /**
   * Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  allowCidr(cidr: string): this
  /**
   * Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  denyCidr(cidr: string): this
  /** The version of PROXY protocol to use with this listener "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Listener backend metadata. Viewable via the dashboard and API, but has no
   * bearing on listener behavior.
   *
   * To automatically forward connections, you can use {@link listenAndForward},
   * or {@link listenAndServe} on the Listener Builder. These methods will also
   * set this `forwardsTo` value.
   */
  forwardsTo(forwardsTo: string): this
  policy(policy: string): this
}
/**
 *r" An ngrok listener backing a TCP endpoint.
 *r"
 *r" @group Listener Builders
 */
export class TcpListenerBuilder {
  /** Listener-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Whether to disable certificate verification for this listener. */
  verifyUpstreamTls(verifyUpstreamTls: boolean): this
  /** Begin listening for new connections on this listener. */
  listen(bind?: boolean | undefined | null): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given url.
   * This method will also set the `forwardsTo` value.
   */
  listenAndForward(toUrl: string): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given server.
   * This method will also set the `forwardsTo` value.
   */
  listenAndServe(server: any): Promise<Listener>
  /**
   * Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  allowCidr(cidr: string): this
  /**
   * Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  denyCidr(cidr: string): this
  /** The version of PROXY protocol to use with this listener "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Listener backend metadata. Viewable via the dashboard and API, but has no
   * bearing on listener behavior.
   *
   * To automatically forward connections, you can use {@link listenAndForward},
   * or {@link listenAndServe} on the Listener Builder. These methods will also
   * set this `forwardsTo` value.
   */
  forwardsTo(forwardsTo: string): this
  policy(policy: string): this
  /**
   * The TCP address to request for this edge.
   * These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
   */
  remoteAddr(remoteAddr: string): this
}
/**
 *r" An ngrok listener backing a TLS endpoint.
 *r"
 *r" @group Listener Builders
 */
export class TlsListenerBuilder {
  /** Listener-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Whether to disable certificate verification for this listener. */
  verifyUpstreamTls(verifyUpstreamTls: boolean): this
  /** Begin listening for new connections on this listener. */
  listen(bind?: boolean | undefined | null): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given url.
   * This method will also set the `forwardsTo` value.
   */
  listenAndForward(toUrl: string): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given server.
   * This method will also set the `forwardsTo` value.
   */
  listenAndServe(server: any): Promise<Listener>
  /**
   * Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  allowCidr(cidr: string): this
  /**
   * Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
   * Call multiple times to add additional CIDR ranges.
   * See [IP restrictions] in the ngrok docs for additional details.
   *
   * [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
   */
  denyCidr(cidr: string): this
  /** The version of PROXY protocol to use with this listener "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Listener backend metadata. Viewable via the dashboard and API, but has no
   * bearing on listener behavior.
   *
   * To automatically forward connections, you can use {@link listenAndForward},
   * or {@link listenAndServe} on the Listener Builder. These methods will also
   * set this `forwardsTo` value.
   */
  forwardsTo(forwardsTo: string): this
  policy(policy: string): this
  /**
   * The domain to request for this edge, any valid domain or hostname that you have
   * previously registered with ngrok. If using a custom domain, this requires
   * registering in the [ngrok dashboard] and setting a DNS CNAME value.
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
   */
  domain(domain: string): this
  /**
   * Certificates to use for client authentication at the ngrok edge.
   * See [Mutual TLS] in the ngrok docs for additional details.
   *
   * [Mutual TLS]: https://ngrok.com/docs/cloud-edge/modules/mutual-tls/
   */
  mutualTlsca(mutualTlsca: Uint8Array): this
  /**
   * The key to use for TLS termination at the ngrok edge in PEM format.
   * See [TLS Termination] in the ngrok docs for additional details.
   *
   * [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
   */
  termination(certPem: Uint8Array, keyPem: Uint8Array): this
}
/**
 *r" A labeled ngrok listener.
 *r"
 *r" @group Listener Builders
 */
export class LabeledListenerBuilder {
  /** Listener-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Whether to disable certificate verification for this listener. */
  verifyUpstreamTls(verifyUpstreamTls: boolean): this
  /** Begin listening for new connections on this listener. */
  listen(bind?: boolean | undefined | null): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given url.
   * This method will also set the `forwardsTo` value.
   */
  listenAndForward(toUrl: string): Promise<Listener>
  /**
   * Begin listening for new connections on this listener and forwarding them to the given server.
   * This method will also set the `forwardsTo` value.
   */
  listenAndServe(server: any): Promise<Listener>
  /**
   * Add a label, value pair for this listener.
   * See [Using Labels] in the ngrok docs for additional details.
   *
   * [Using Labels]: https://ngrok.com/docs/guides/using-labels-within-ngrok/
   */
  label(label: string, value: string): this
  /** Set the L7 application portocol for this listener, i.e. "http1" or "http2" (defaults "http1") */
  appProtocol(appProtocol: string): this
}
/**
 * The builder for an ngrok session.
 *
 * @group Listener and Sessions
 */
export class SessionBuilder {
  /** Create a new session builder */
  constructor()
  /**
   * Configures the session to authenticate with the provided authtoken. You
   * can [find your existing authtoken] or [create a new one] in the ngrok
   * dashboard.
   *
   * See the [authtoken parameter in the ngrok docs] for additional details.
   *
   * [find your existing authtoken]: https://dashboard.ngrok.com/get-started/your-authtoken
   * [create a new one]: https://dashboard.ngrok.com/tunnels/authtokens
   * [authtoken parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#authtoken
   */
  authtoken(authtoken: string): this
  /**
   * Shortcut for calling [SessionBuilder::authtoken] with the value of the
   * NGROK_AUTHTOKEN environment variable.
   */
  authtokenFromEnv(): this
  /**
   * Add client type and version information for a client application.
   *
   * This is a way for applications and library consumers of this crate
   * identify themselves.
   *
   * This will add a new entry to the `User-Agent` field in the "most significant"
   * (first) position. Comments must follow [RFC 7230] or a connection error may occur.
   *
   * [RFC 7230]: https://datatracker.ietf.org/doc/html/rfc7230#section-3.2.6
   */
  clientInfo(clientType: string, version: string, comments?: string | undefined | null): this
  /**
   * Configures how often the session will send heartbeat messages to the ngrok
   * service to check session liveness.
   *
   * See the [heartbeat_interval parameter in the ngrok docs] for additional
   * details.
   *
   * [heartbeat_interval parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#heartbeat_interval
   */
  heartbeatInterval(heartbeatInterval: number): this
  /**
   * Configures the duration to wait for a response to a heartbeat before
   * assuming the session connection is dead and attempting to reconnect.
   *
   * See the [heartbeat_tolerance parameter in the ngrok docs] for additional
   * details.
   *
   * [heartbeat_tolerance parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#heartbeat_tolerance
   */
  heartbeatTolerance(heartbeatTolerance: number): this
  /**
   * Configures the opaque, machine-readable metadata string for this session.
   * Metadata is made available to you in the ngrok dashboard and the Agents API
   * resource. It is a useful way to allow you to uniquely identify sessions. We
   * suggest encoding the value in a structured format like JSON.
   *
   * See the [metdata parameter in the ngrok docs] for additional details.
   *
   * [metdata parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#metadata
   */
  metadata(metadata: string): this
  /**
   * Configures the network address to dial to connect to the ngrok service.
   * Use this option only if you are connecting to a custom agent ingress.
   *
   * See the [server_addr parameter in the ngrok docs] for additional details.
   *
   * [server_addr parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#server_addr
   */
  serverAddr(addr: string): this
  /**
   * Configures the TLS certificate used to connect to the ngrok service while
   * establishing the session. Use this option only if you are connecting through
   * a man-in-the-middle or deep packet inspection proxy. Pass in the bytes of the certificate
   * to be used to validate the connection, then override the address to connect to via
   * the server_addr call.
   *
   * Roughly corresponds to the [root_cas parameter in the ngrok docs].
   *
   * [root_cas parameter in the ngrok docs]: https://ngrok.com/docs/ngrok-agent/config#root_cas
   */
  caCert(certBytes: Uint8Array): this
  /**
   * Configures a function which is called to after a disconnection to the
   * ngrok service. In the event of network disruptions, it will be called each time
   * the session reconnects. The handler is given the address that will be used to
   * connect the session to, e.g. "example.com:443", and the message from the error
   * that occurred. Returning true from the handler will cause the session to
   * reconnect, returning false will cause the Session to throw an uncaught error.
   */
  handleDisconnection(handler: (addr: string, error: string) => boolean): this
  /**
   * Configures a function which is called when the ngrok service requests that
   * this [Session] stops. Your application may choose to interpret this callback
   * as a request to terminate the [Session] or the entire process.
   *
   * Errors returned by this function will be visible to the ngrok dashboard or
   * API as the response to the Stop operation.
   *
   * Do not block inside this callback. It will cause the Dashboard or API
   * stop operation to time out. Do not call [std::process::exit] inside this
   * callback, it will also cause the operation to time out.
   */
  handleStopCommand(handler: () => void): this
  /**
   * Configures a function which is called when the ngrok service requests
   * that this [Session] updates. Your application may choose to interpret
   * this callback as a request to restart the [Session] or the entire
   * process.
   *
   * Errors returned by this function will be visible to the ngrok dashboard or
   * API as the response to the Restart operation.
   *
   * Do not block inside this callback. It will cause the Dashboard or API
   * stop operation to time out. Do not call [std::process::exit] inside this
   * callback, it will also cause the operation to time out.
   */
  handleRestartCommand(handler: () => void): this
  /**
   * Configures a function which is called when the ngrok service requests
   * that this [Session] updates. Your application may choose to interpret
   * this callback as a request to update its configuration, itself, or to
   * invoke some other application-specific behavior.
   *
   * Errors returned by this function will be visible to the ngrok dashboard or
   * API as the response to the Restart operation.
   *
   * Do not block inside this callback. It will cause the Dashboard or API
   * stop operation to time out. Do not call [std::process::exit] inside this
   * callback, it will also cause the operation to time out.
   */
  handleUpdateCommand(handler: (update: UpdateRequest) => void): this
  /**
   * Call the provided handler whenever a heartbeat response is received,
   * with the latency in milliseconds.
   *
   * If the handler returns an error, the heartbeat task will exit, resulting
   * in the session eventually dying as well.
   */
  handleHeartbeat(handler: (latency: number) => void): this
  /** Attempt to establish an ngrok session using the current configuration. */
  connect(): Promise<Session>
}
/**
 * An ngrok session.
 *
 * @group Listener and Sessions
 */
export class Session {
  /** Start building a listener backing an HTTP endpoint. */
  httpEndpoint(): HttpListenerBuilder
  /** Start building a listener backing a TCP endpoint. */
  tcpEndpoint(): TcpListenerBuilder
  /** Start building a listener backing a TLS endpoint. */
  tlsEndpoint(): TlsListenerBuilder
  /** Start building a labeled listener. */
  labeledListener(): LabeledListenerBuilder
  /** Retrieve a list of this session's non-closed listeners, in no particular order. */
  listeners(): Promise<Array<Listener>>
  /** Close a listener with the given ID. */
  closeListener(id: string): Promise<void>
  /** Close the ngrok session. */
  close(): Promise<void>
}
/** Container for UpdateRequest information. */
export class UpdateRequest {
  /** The version that the agent is requested to update to. */
  version: string
  /** Whether or not updating to the same major version is sufficient. */
  permitMajorVersion: boolean
}
/**
 * Get a listenable ngrok listener, suitable for passing to net.Server.listen().
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate.
 */
export function listenable(): Listener;
/**
 * Start the given net.Server listening to a generated, or passed in, listener.
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new listener is created.
 */
export function listen(server: import("net").Server, listener?: Listener): Listener;
/**
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String): void;
