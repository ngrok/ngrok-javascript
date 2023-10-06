/* tslint:disable */
/* eslint-disable */

/* auto-generated by NAPI-RS */

/**
 * Configuration object to pass to ngrok.connect()
 *
 * @group Functions
 */
export interface Config {
  /**
   * Port, network address, or named pipe. Defaults to 80.
   * Examples: "80", "localhost:8080", "unix:/tmp/my.sock", "pipe://./my-pipe"
   */
  addr?: number|string
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
   */
  circuit_breaker?: number
  /** Enable gzip compression for HTTP responses. */
  compression?: boolean
  /** Unused, will warn and be ignored */
  configPath?: string
  /**
   * The certificate to use for TLS termination at the ngrok edge in PEM format.
   * Only used if "proto" is "tls".
   */
  crt?: string
  /** The domain to request for this edge. */
  domain?: string
  /**
   * Returns a human-readable string presented in the ngrok dashboard
   * and the Tunnels API.
   */
  forwards_to?: string
  /** Unused, will warn and be ignored */
  host_header?: string
  /**
   * The hostname for the tunnel to forward to.
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
   * The certificate to use for TLS termination at the ngrok edge in PEM format.
   * Only used if "proto" is "tls".
   */
  key?: string
  /** Add label, value pairs for this tunnel, colon separated. */
  labels?: string|Array<string>
  /** Tunnel-specific opaque metadata. Viewable via the API. */
  metadata?: string
  /**
   * Certificates to use for client authentication at the ngrok edge.
   * Only used if "proto" is "tls" or "http".
   */
  mutual_tls_cas?: string|Array<string>
  /** Unused, will warn and be ignored */
  name?: string
  /** OAuth configuration of domains to allow. */
  oauth_allow_domains?: string|Array<string>
  /** OAuth configuration of email addresses to allow. */
  oauth_allow_emails?: string|Array<string>
  /** OAuth configuration of scopes. */
  oauth_scopes?: string|Array<string>
  /**
   * OAuth configuration of the provider, e.g. "google".
   * https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth_provider?: string
  /** OIDC configuration of client ID. */
  oidc_client_id?: string
  /** OIDC configuration of client secret. */
  oidc_client_secret?: string
  /** OIDC configuration of scopes. */
  oidc_scopes?: string|Array<string>
  /** OIDC configuration of the issuer URL. */
  oidc_issuer_url?: string
  /** OIDC configuration of domains to allow. */
  oidc_allow_domains?: string|Array<string>
  /** OIDC configuration of email addresses to allow. */
  oidc_allow_emails?: string|Array<string>
  /** Returns log messages from the ngrok library. */
  onLogEvent?: (data: string) => void
  /** 'closed' - connection is lost, 'connected' - reconnected */
  onStatusChange?: (status: string) => void
  /**
   * The port for the tunnel to forward to.
   * Only used if addr is not defined.
   */
  port?: number
  /** The type of tunnel to use, one of http|tcp|tls|labeled, defaults to http. */
  proto?: string
  /** The version of PROXY protocol to use with this tunnel "1", "2", or "" if not using. */
  proxy_proto?: string
  /** Adds a header to all requests to this edge. */
  request_header_add?: string|Array<string>
  /** Removes a header from requests to this edge. */
  request_header_remove?: string|Array<string>
  /** Adds a header to all responses coming from this edge. */
  response_header_add?: string|Array<string>
  /** Removes a header from responses from this edge. */
  response_header_remove?: string|Array<string>
  /** Unused, will warn and be ignored */
  region?: string
  /**
   * The TCP address to request for this edge.
   * Only used if proto is "tcp".
   */
  remote_addr?: string
  /**
   * The scheme that this edge should use, defaults to "https".
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
  /** WebhookVerification configuration, the provider to use. */
  verify_webhook_provider?: string
  /** WebhookVerification configuration, the secret to use. */
  verify_webhook_secret?: string
  /** Unused, will warn and be ignored */
  web_addr?: string
  /** Convert incoming websocket connections to TCP-like streams. */
  websocket_tcp_converter?: boolean
}
/** Transform a json object configuration into a tunnel */
export function connect(config: Config|string|number): Promise<string>
/** Close a tunnel with the given url, or all tunnels if no url is defined. */
export function disconnect(url?: string | undefined | null): Promise<void>
/** Close all tunnels. */
export function kill(): Promise<void>
/**
 * Register a callback function that will receive logging event information.
 * An absent callback will unregister an existing callback function.
 * The log level defaults to INFO, it can be set to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function loggingCallback(callback?: (level: string, target: string, message: string) => void, level?: string): void
/** Set the default auth token to use for any future sessions. */
export function authtoken(authtoken: string): Promise<void>
/** Retrieve a list of non-closed tunnels, in no particular order. */
export function tunnels(): Promise<Array<NgrokTunnel>>
/** Retrieve tunnel using the id */
export function getTunnel(id: string): Promise<NgrokTunnel | null>
/** Retrieve tunnel using the url */
export function getTunnelByUrl(url: string): Promise<NgrokTunnel | null>
/**
 * The builder for an ngrok session.
 *
 * @group Tunnel and Sessions
 */
export class NgrokSessionBuilder {
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
  connect(): Promise<NgrokSession>
}
/**
 * An ngrok session.
 *
 * @group Tunnel and Sessions
 */
export class NgrokSession {
  /** Start building a tunnel backing an HTTP endpoint. */
  httpEndpoint(): NgrokHttpTunnelBuilder
  /** Start building a tunnel backing a TCP endpoint. */
  tcpEndpoint(): NgrokTcpTunnelBuilder
  /** Start building a tunnel backing a TLS endpoint. */
  tlsEndpoint(): NgrokTlsTunnelBuilder
  /** Start building a labeled tunnel. */
  labeledTunnel(): NgrokLabeledTunnelBuilder
  /** Retrieve a list of this session's non-closed tunnels, in no particular order. */
  tunnels(): Promise<Array<NgrokTunnel>>
  /** Close a tunnel with the given ID. */
  closeTunnel(id: string): Promise<void>
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
 * An ngrok tunnel.
 *
 * @group Tunnel and Sessions
 */
export class NgrokTunnel {
  /** The URL that this tunnel backs. */
  url(): string | null
  /** The protocol of the endpoint that this tunnel backs. */
  proto(): string | null
  /** The labels this tunnel was started with. */
  labels(): Record<string, string>
  /** Returns a tunnel's unique ID. */
  id(): string
  /**
   * Returns a human-readable string presented in the ngrok dashboard
   * and the Tunnels API. Use the [HttpTunnelBuilder::forwards_to],
   * [TcpTunnelBuilder::forwards_to], etc. to set this value
   * explicitly.
   */
  forwardsTo(): string
  /** Returns the arbitrary metadata string for this tunnel. */
  metadata(): string
  /**
   * Forward incoming tunnel connections. This can be either a TCP address or a file socket path.
   * For file socket paths on Linux/Darwin, addr can be a unix domain socket path, e.g. "/tmp/ngrok.sock"
   *     On Windows, addr can be a named pipe, e.e. "\\\\.\\pipe\\an_ngrok_pipe
   */
  forward(addr: string): Promise<void>
  /** Wait for the forwarding task to exit. */
  join(): Promise<void>
  /**
   * Close the tunnel.
   *
   * This is an RPC call that must be `.await`ed.
   * It is equivalent to calling `Session::close_tunnel` with this
   * tunnel's ID.
   */
  close(): Promise<void>
}
/**
 *r" An ngrok tunnel backing an HTTP endpoint.
 *r"
 *r" @group Tunnel Builders
 */
export class NgrokHttpTunnelBuilder {
  /**
   * The scheme that this edge should use.
   * "HTTPS" or "HTTP", defaults to "HTTPS".
   */
  scheme(scheme: string): this
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
   * OAuth configuration.
   * If not called, OAuth is disabled.
   * See [OAuth] in the ngrok docs for additional details.
   *
   * [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
   */
  oauth(provider: string, allowEmails?: Array<string> | undefined | null, allowDomains?: Array<string> | undefined | null, scopes?: Array<string> | undefined | null): this
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
  /** Tunnel-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Begin listening for new connections on this tunnel. */
  listen(bind?: boolean | undefined | null): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given url. */
  listenAndForward(toUrl: string): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given server. */
  listenAndServe(server: any): Promise<NgrokTunnel>
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
  /** The version of PROXY protocol to use with this tunnel "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Tunnel backend metadata. Viewable via the dashboard and API, but has no
   * bearing on tunnel behavior.
   */
  forwardsTo(forwardsTo: string): this
}
/**
 *r" An ngrok tunnel backing a TCP endpoint.
 *r"
 *r" @group Tunnel Builders
 */
export class NgrokTcpTunnelBuilder {
  /**
   * The TCP address to request for this edge.
   * These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
   *
   * [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
   */
  remoteAddr(remoteAddr: string): this
  /** Tunnel-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Begin listening for new connections on this tunnel. */
  listen(bind?: boolean | undefined | null): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given url. */
  listenAndForward(toUrl: string): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given server. */
  listenAndServe(server: any): Promise<NgrokTunnel>
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
  /** The version of PROXY protocol to use with this tunnel "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Tunnel backend metadata. Viewable via the dashboard and API, but has no
   * bearing on tunnel behavior.
   */
  forwardsTo(forwardsTo: string): this
}
/**
 *r" An ngrok tunnel backing a TLS endpoint.
 *r"
 *r" @group Tunnel Builders
 */
export class NgrokTlsTunnelBuilder {
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
  /** Tunnel-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Begin listening for new connections on this tunnel. */
  listen(bind?: boolean | undefined | null): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given url. */
  listenAndForward(toUrl: string): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given server. */
  listenAndServe(server: any): Promise<NgrokTunnel>
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
  /** The version of PROXY protocol to use with this tunnel "1", "2", or "" if not using. */
  proxyProto(proxyProto: string): this
  /**
   * Tunnel backend metadata. Viewable via the dashboard and API, but has no
   * bearing on tunnel behavior.
   */
  forwardsTo(forwardsTo: string): this
}
/**
 *r" A labeled ngrok tunnel.
 *r"
 *r" @group Tunnel Builders
 */
export class NgrokLabeledTunnelBuilder {
  /** Tunnel-specific opaque metadata. Viewable via the API. */
  metadata(metadata: string): this
  /** Begin listening for new connections on this tunnel. */
  listen(bind?: boolean | undefined | null): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given url. */
  listenAndForward(toUrl: string): Promise<NgrokTunnel>
  /** Begin listening for new connections on this tunnel and forwarding them to the given server. */
  listenAndServe(server: any): Promise<NgrokTunnel>
  /**
   * Add a label, value pair for this listener.
   * See [Using Labels] in the ngrok docs for additional details.
   *
   * [Using Labels]: https://ngrok.com/docs/guides/using-labels-within-ngrok/
   */
  label(label: string, value: string): this
}
/**
 * Get a listenable ngrok tunnel, suitable for passing to net.Server.listen().
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate.
 */
export function listenable(): NgrokTunnel;
/**
 * Start the given net.Server listening to a generated, or passed in, tunnel.
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new tunnel is created.
 */
export function listen(server: import("net").Server, tunnel?: NgrokTunnel): NgrokTunnel;
/**
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String): void;
