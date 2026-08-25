# JavaScript SDK for ngrok

[![npm.rs][npm-badge]][npm-url]
[![MIT licensed][mit-badge]][mit-url]
[![Apache-2.0 licensed][apache-badge]][apache-url]
[![Continuous integration][ci-badge]][ci-url]

[npm-badge]: https://img.shields.io/npm/v/@ngrok/ngrok.svg
[npm-url]: https://www.npmjs.com/package/@ngrok/ngrok
[mit-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[mit-url]: https://github.com/ngrok/ngrok-rust/blob/main/LICENSE-MIT
[apache-badge]: https://img.shields.io/badge/license-Apache_2.0-blue.svg
[apache-url]: https://github.com/ngrok/ngrok-rust/blob/main/LICENSE-APACHE
[ci-badge]: https://github.com/ngrok/ngrok-javascript/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/ngrok/ngrok-javascript/actions/workflows/ci.yml

`ngrok-javascript` is the official Node.js SDK for ngrok that requires no binaries. Quickly enable secure production-ready connectivity to your applications and services directly from your code.

[ngrok](https://ngrok.com) is a globally distributed gateway that provides secure connectivity for applications and services running in any environment.

# Installation

Using npm:

```shell
npm install @ngrok/ngrok
```

Using yarn:

```shell
yarn add @ngrok/ngrok
```

Using pnpm:

```shell
pnpm add @ngrok/ngrok
```

# Quickstart

1. [Install `@ngrok/ngrok`](#installation)
2. Export your authtoken from [the ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken) as `NGROK_AUTHTOKEN` in your terminal
3. Add the following code to your application to establish connectivity via the [forward method](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-forward-minimal.js) through port `8080` over `localhost`:

    ```jsx
    // Require ngrok javascript sdk
    const ngrok = require("@ngrok/ngrok");
    // import ngrok from '@ngrok/ngrok' // if inside a module
    
    (async function() {
      // Establish connectivity
      const endpoint = await ngrok.forward({ addr: 8080, authtoken_from_env: true });
    
      // Output ngrok url to console
      console.log(`Ingress established at: ${endpoint.url()}`);
    })();

    process.stdin.resume();
    ```

That's it! Your application should now be available through the url output in your terminal. 

> **Note**
> You can find more examples in [the examples directory](https://github.com/ngrok/ngrok-javascript/tree/main/examples).

# Documentation

A quickstart guide and a full API reference are included in the [ngrok-javascript documentation](https://ngrok.github.io/ngrok-javascript/).

### Migrating from edge modules

ngrok is deprecating the old per-edge "modules" (basic auth, OAuth/OIDC, webhook
verification, circuit breaker, compression, IP restrictions, request/response header
add/remove, mutual TLS, ...) in favor of [Traffic Policy](https://ngrok.com/docs/traffic-policy/),
a single YAML/JSON document evaluated at the ngrok edge. This version of `ngrok-javascript`
reflects that: the old `SessionBuilder`/`Session`/`Listener`/`HttpListenerBuilder`/
`TcpListenerBuilder`/`TlsListenerBuilder`/`LabeledListenerBuilder` classes and their
per-module builder methods (`.basicAuth()`, `.oauth()`, `.oidc()`, `.webhookVerification()`,
`.circuitBreaker()`, `.compression()`, `.allowCidr()`/`.denyCidr()`, `.requestHeader()`/
`.responseHeader()`, `.mutualTlsca()`, `.websocketTcpConversion()`, `.allowUserAgent()`/
`.denyUserAgent()`, labeled listeners, ...) are gone. In their place:

- `SessionBuilder`/`Session` → [`AgentBuilder`](https://ngrok.github.io/ngrok-javascript/classes/AgentBuilder.html)/[`Agent`](https://ngrok.github.io/ngrok-javascript/classes/Agent.html)
- `HttpListenerBuilder`/`TcpListenerBuilder`/`TlsListenerBuilder` → a single [`EndpointBuilder`](https://ngrok.github.io/ngrok-javascript/classes/EndpointBuilder.html), created via `agent.httpEndpoint()`/`agent.tcpEndpoint()`/`agent.tlsEndpoint()`
- `Listener` → [`Endpoint`](https://ngrok.github.io/ngrok-javascript/classes/Endpoint.html)
- Everything the old edge modules did → a [`trafficPolicy`](https://ngrok.com/docs/traffic-policy/) YAML/JSON string passed to `EndpointBuilder.trafficPolicy()`/`Config.traffic_policy`

Labeled listeners have no replacement. Custom TLS termination at the edge (the old
`TlsListenerBuilder.termination()`) is not currently exposed by this package either.

### Authorization

To use ngrok you'll need an authtoken. To obtain one, sign up for free at [ngrok.com](https://dashboard.ngrok.com/signup) and retrieve it from the [authtoken page of your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken). Once you have copied your authtoken, you can reference it in several ways.

You can set it in the `NGROK_AUTHTOKEN` environment variable and pass `authtoken_from_env: true` to the [forward](https://ngrok.github.io/ngrok-javascript/functions/forward.html) method:

```jsx
await ngrok.forward({ authtoken_from_env: true, ... });
```

Or pass the authtoken directly to the [forward](https://ngrok.github.io/ngrok-javascript/functions/forward.html) method:

```jsx
await ngrok.forward({ authtoken: token, ... });
```

Or set it for all connections with the [authtoken](https://ngrok.github.io/ngrok-javascript/functions/authtoken.html) method:

```jsx
await ngrok.authtoken(token);
```

### Connection

The [forward](https://ngrok.github.io/ngrok-javascript/functions/forward.html) method is the easiest way to start an ngrok agent and establish an endpoint forwarding to a specified address. The [forward](https://ngrok.github.io/ngrok-javascript/functions/forward.html) method returns a promise that resolves to the created endpoint.

With no arguments the [forward](https://ngrok.github.io/ngrok-javascript/functions/forward.html) method will start an HTTP endpoint to `localhost` port `80`:

```jsx
const ngrok = require("@ngrok/ngrok");
// import ngrok from '@ngrok/ngrok' // if inside a module

(async function() {
  console.log( (await ngrok.forward()).url() );
})();
```

You can pass the port number to forward on `localhost`:

```jsx
const endpoint = await ngrok.forward(4242);
```

Or you can specify the host and port via a string:

```jsx
const endpoint = await ngrok.forward("localhost:4242");
```

More options can be passed to the `forward` method to customize the connection, including a [Traffic Policy](https://ngrok.com/docs/traffic-policy/) document for anything module-shaped (auth, headers, IP restrictions, ...):

```jsx
const endpoint = await ngrok.forward({ addr: 8080, traffic_policy: myPolicyYaml });
```

The (optional) `proto` parameter is the endpoint type, which defaults to `http`. To create a TCP endpoint:

```jsx
const endpoint = await ngrok.forward({ proto: 'tcp', addr: 25565 });
```

See [Full Configuration](#full-configuration) for the list of possible configuration options.

### Disconnection

The [close](https://ngrok.github.io/ngrok-javascript/classes/Endpoint.html#close) method on an endpoint will shut it down. This method returns a promise that resolves when the endpoint is closed.

```jsx
const endpoint = await ngrok.getEndpointByUrl(url);
await endpoint.close();
```

Or use the [disconnect](https://ngrok.github.io/ngrok-javascript/functions/disconnect.html) method with the `url()` of the endpoint to close:

```jsx
await ngrok.disconnect(endpoint.url());
```

Or omit the `url()` to close all endpoints and disconnect the agent:

```jsx
await ngrok.disconnect();
```

### Listing Endpoints

To list all current non-closed endpoints use the [endpoints](https://ngrok.github.io/ngrok-javascript/functions/endpoints.html) method:

```jsx
const currentEndpoints = await ngrok.endpoints();
```

### Builders

For more control over Agents and Endpoints, the builder classes can be used.

A minimal example using the builder class looks like [the following](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-http-minimum.js):

```jsx
async function create_endpoint() {
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward("localhost:8081");
  console.log("Ingress established at:", endpoint.url());
}
```

See here for a [Full Configuration Example](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-http-full.js)

### TLS Backends

Backend TLS connections are validated by a filepath specified in the `SSL_CERT_FILE` environment variable, or falling back to the host OS installed trusted certificate authorities. So it is possible to do this to forward:

```jsx
await ngrok.forward({ addr: "https://127.0.0.1:3000", authtoken_from_env: true });
```

If the service is using certs not trusted by the OS, such as self-signed certificates, add an environment variable like this before running: `SSL_CERT_FILE=/path/to/ca.crt`. There is also a `verify_upstream_tls: false` option (or `UpstreamOptions.verifyUpstreamTls` on `EndpointBuilder.forward()`) to disable certificate verification for the upstream connection.

### Async Programming

All methods return a `Promise` and are suitable for use in asynchronous
programming. You can use callback chaining with `.then()` and `.catch()` syntax
or the `await` keyword to wait for completion of an API call.

#### Error Handling

All asynchronous functions will throw an error on failure to set up a session or listener,
which can be caught and dealt with using try/catch or then/catch statements:

```jsx
await new ngrok.AgentBuilder().authtokenFromEnv().connect()
    .then((agent) => {
        agent.httpEndpoint().forward("localhost:8081")
            .then((endpoint) => {})
            .catch(err => console.log('endpoint setup error: ' + err))
    })
    .catch(err => console.log('agent setup error: ' + err));
```

### Full Configuration

This example shows [all the possible configuration items of ngrok.forward](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-forward-full.js):

```jsx
const endpoint = await ngrok.forward({
  // agent configuration
  addr: `localhost:8080`, // or `8080` -- this fork's upstream dialer only supports TCP, not unix sockets
  authtoken: "<authtoken>",
  authtoken_from_env: true,
  onStatusChange: (status) => {
    console.log(`Ngrok status changed: ${status}`);
  },
  session_metadata: "Online in One Line",
  // advanced agent connection configuration
  connect_url: "example.com:443",
  session_ca_cert: fs.readFileSync("ca.pem", "utf8"),
  // endpoint configuration
  metadata: "example endpoint metadata from javascript",
  name: "my-endpoint",
  description: "a human-readable description",
  domain: "<domain>",
  proto: "http",
  pooling_enabled: false,
  binding: "public", // One of: "public", "internal", "kubernetes"
  // everything the old edge modules did (basic auth, OAuth/OIDC, webhook
  // verification, circuit breaker, compression, IP restrictions, header
  // add/remove, mutual TLS, ...) is now expressed as a Traffic Policy document,
  // see https://ngrok.com/docs/traffic-policy/
  traffic_policy: `
on_http_request:
  - actions:
      - type: basic-auth
        config:
          credentials:
            - ngrok:online1line
`,
  // upstream (agent -> your local server) configuration
  upstream_protocol: "http2",
  verify_upstream_tls: false,
  proxy_proto: "", // One of: "", "1", "2"
});
```

The [Config](https://ngrok.github.io/ngrok-javascript/interfaces/Config.html) interface also shows all the available options.

# Examples

Degit can be used for cloning and running an example directory like this:
```bash
npx degit github:ngrok/ngrok-javascript/examples/<example> <folder-name>
cd <folder-name>
npm i
```
For example:
```bash
npx degit github:ngrok/ngrok-javascript/examples/express express && cd express && npm i
```

#### Frameworks
- [AWS App Runner](https://github.com/ngrok/ngrok-sdk-serverless-example)
- [Express](https://github.com/ngrok/ngrok-javascript/blob/main/examples/express)
- [Fastify Example](https://github.com/ngrok/ngrok-javascript/blob/main/examples/fastify)
- [Hapi Example](https://github.com/ngrok/ngrok-javascript/blob/main/examples/hapi)
- [Koa Example](https://github.com/ngrok/ngrok-javascript/blob/main/examples/koa)
- [Nest.js](https://github.com/ngrok/ngrok-javascript/blob/main/examples/nestjs)
- [Next.js](https://github.com/ngrok/ngrok-javascript/blob/main/examples/nextjs)
- [Remix](https://github.com/ngrok/ngrok-javascript/blob/main/examples/remix)
- [Svelte](https://github.com/ngrok/ngrok-javascript/blob/main/examples/svelte)
- [Typescript](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-typescript.ts)
- [Vue](https://github.com/ngrok/ngrok-javascript/blob/main/examples/vue)
- [Winston (Logging)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-winston.js)

#### Endpoints
* [ngrok.forward (minimal)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-forward-minimal.js)
* [ngrok.forward (full)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-forward-full.js)
* [HTTP (ngrok.listen)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-listen.js)
* [HTTP (AgentBuilder minimal)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-http-minimum.js)
* [HTTP (AgentBuilder full)](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-http-full.js)
* [TCP](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-tcp.js)
* [TLS](https://github.com/ngrok/ngrok-javascript/blob/main/examples/ngrok-tls.js)

> **Note**
> Labeled endpoints have been removed (see [Migrating from edge modules](#migrating-from-edge-modules)); `examples/ngrok-labeled.js` documents this rather than showing usage.
>
> Forwarding to a Windows named pipe or unix domain socket is not currently supported by this fork (its upstream dialer only dials TCP); `examples/ngrok-windows-pipe.js` documents this rather than showing usage.

# Platform Support

Pre-built binaries are provided on NPM for the following platforms:

| OS         | i686 | x64 | aarch64 | arm |
| ---------- | -----|-----|---------|-----|
| Windows    |   ✓  |  ✓  |    ✓    |     |
| MacOS      |      |  ✓  |    ✓    |  ✓  |
| Linux      |      |  ✓  |    ✓    |  ✓  |
| Linux musl |      |  ✓  |    ✓    |     |
| FreeBSD    |      |  ✓  |         |     |
| Android    |      |     |    ✓    |  ✓  |

> **Note**
> `ngrok-javascript`, and [ngrok-rust](https://github.com/ngrok/ngrok-rust/) which it depends on, are open source, so it may be possible to build them for other platforms.
> 
> On Windows, ensure you have [Microsoft Visual C++ Redistributable](https://learn.microsoft.com/en-us/cpp/windows/latest-supported-vc-redist?view=msvc-170#latest-microsoft-visual-c-redistributable-version) installed.
>
>  We currently support MacOS 10.13+. 

# Dependencies

- [NAPI-RS](https://napi.rs/), an excellent system to ease development and building of Rust plugins for NodeJS.

# Changelog

Changes to `ngrok-javascript` are tracked under [CHANGELOG.md](https://github.com/ngrok/ngrok-javascript/blob/main/CHANGELOG.md).


# Join the ngrok Community

- Check out [our official docs](https://docs.ngrok.com)
- Read about updates on [our blog](https://blog.ngrok.com)
- Open an [issue](https://github.com/ngrok/ngrok-javascript/issues) or [pull request](https://github.com/ngrok/ngrok-javascript/pulls)
- Follow us on [X / Twitter (@ngrokHQ)](https://twitter.com/ngrokhq)
- Subscribe to our [Youtube channel (@ngrokHQ)](https://www.youtube.com/@ngrokhq)

# License

This work is dual-licensed under [Apache, Version 2.0](LICENSE-APACHE) and [MIT](LICENSE-MIT).
You can choose between one of them if you use this work.

### Contributions

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in `ngrok-javascript` by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
