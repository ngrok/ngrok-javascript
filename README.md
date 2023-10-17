# The ngrok Agent SDK for NodeJS

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
[ci-badge]: https://github.com/ngrok/ngrok-nodejs/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/ngrok/ngrok-nodejs/actions/workflows/ci.yml

**Note: This is beta-quality software. Interfaces may change without warning.**

[ngrok](https://ngrok.com) is a globally distributed reverse proxy commonly used for quickly getting a public URL to a
service running inside a private network, such as on your local laptop. The ngrok agent is usually
deployed inside a private network and is used to communicate with the ngrok cloud service.

This is the ngrok agent in library form, suitable for integrating directly into NodeJS
applications. This allows you to quickly build ngrok into your application with no separate process
to manage.

# Documentation

A quickstart guide and a full API reference are included in the [ngrok-nodejs API documentation](https://ngrok.github.io/ngrok-nodejs/).

# Quickstart

1. Install the `ngrok-nodejs` package from
[npm](https://www.npmjs.com/package/@ngrok/ngrok):

```shell
npm install @ngrok/ngrok
```

2. After you've installed the package, you'll need an authtoken. Retrieve one on the
[authtoken page of your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)

3. Add the following code block using the [connect method](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-connect-minimal.js) to expose your nodejs application at port `8080` on `localhost`:

```jsx
const ngrok = require("@ngrok/ngrok");
(async function() {
  const listener = await ngrok.connect({ addr: 8080, authtoken_from_env: true });
  console.log(`Ingress established at: ${listener.url()}`);
})();
```

You can find more examples in [the /examples directory](https://github.com/ngrok/ngrok-nodejs/tree/main/examples).

## Authorization

To use most of ngrok's features, you'll need an authtoken. To obtain one, sign up for free at [ngrok.com](https://dashboard.ngrok.com/signup) and retrieve it from the [authtoken page of your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken). Once you have copied your authtoken, you can reference it in several ways.

You can set it in the `NGROK_AUTHTOKEN` environment variable and pass `authtoken_from_env: true` to the [connect](https://ngrok.github.io/ngrok-nodejs/functions/connect.html) method:

```jsx
await ngrok.connect({authtoken_from_env: true, ...});
```

Or pass the authtoken directly to the [connect](https://ngrok.github.io/ngrok-nodejs/functions/connect.html) method:

```jsx
await ngrok.connect({authtoken: token, ...});
```

Or set it for all connections with the [authtoken](https://ngrok.github.io/ngrok-nodejs/functions/authtoken.html) method:

```jsx
await ngrok.authtoken(token);
```

## Connection

The [connect](https://ngrok.github.io/ngrok-nodejs/functions/connect.html) method is the easiest way to start an ngrok session and establish a listener to a specified address. The [connect](https://ngrok.github.io/ngrok-nodejs/functions/connect.html) method returns a promise that resolves to the public URL of the listener.

With no arguments the [connect](https://ngrok.github.io/ngrok-nodejs/functions/connect.html) method will start an HTTP listener to `localhost` port `80`:

```jsx
const ngrok = require("@ngrok/ngrok");
(async function() {
  console.log( (await ngrok.connect()).url() );
})();
```

You can pass the port number to forward on `localhost`:

```jsx
const listener = await ngrok.connect(4242);
```

Or you can specify the host and port via a string:

```jsx
const listener = await ngrok.connect("localhost:4242");
```

More options can be passed to the `connect` method to customize the connection:

```jsx
const listener = await ngrok.connect({addr: 8080, basic_auth: "ngrok:online1line"});
const listener = await ngrok.connect({addr: 8080, oauth_provider: "google", oauth_allow_domains: "example.com"});
```

The (optional) `proto` parameter is the listener type, which defaults to `http`. To create a TCP listener:

```jsx
const listener = await ngrok.connect({proto: 'tcp', addr: 25565});
```

See [Full Configuration](#full-configuration) for the list of possible configuration options.

## Disconnection

The [close](https://ngrok.github.io/ngrok-nodejs/classes/Listener.html#close) method on a listener will shut it down, and also stop the ngrok session if it is no longer needed. This method returns a promise that resolves when the listener is closed.

```jsx
const listener = await ngrok.getListenerByUrl(url);
await listener.close();
```

Or use the [disconnect](https://ngrok.github.io/ngrok-nodejs/functions/disconnect.html) method with the `url()` of the listener to close (or id() for a Labeled Listener):

```jsx
await ngrok.disconnect(listener.url());
```

Or omit the `url()` to close all listeners:

```jsx
await ngrok.disconnect();
```

## Listing Listeners

To list all current non-closed listeners use the [listeners](https://ngrok.github.io/ngrok-nodejs/functions/listeners.html) method:

```jsx
const listeners = await ngrok.listeners();
```

# Full Configuration

This example shows [all the possible configuration items of ngrok.connect](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-connect-full.js):

```jsx
const listener = await ngrok.connect({
  // session configuration
  addr: `localhost:8080`, // or `8080` or `unix:${UNIX_SOCKET}`
  authtoken: "<authtoken>",
  authtoken_from_env: true,
  on_status_change: (addr, error) => {
    console.log(`disconnected, addr ${addr} error: ${error}`);
  },
  session_metadata: "Online in One Line",
  // listener configuration
  allow_user_agent: "^mozilla.*",
  basic_auth: ["ngrok:online1line"],
  circuit_breaker: 0.1,
  compression: true,
  deny_user_agent: "^curl.*",
  domain: "<domain>",
  ip_restriction_allow_cidrs: ["0.0.0.0/0"],
  ip_restriction_deny_cidrs: ["10.1.1.1/32"],
  metadata: "example listener metadata from nodejs",
  mutual_tls_cas: [fs.readFileSync('ca.crt', 'utf8')],
  oauth_provider: "google",
  oauth_allow_domains: ["<domain>"],
  oauth_allow_emails: ["<email>"],
  oauth_scopes: ["<scope>"],
  oauth_client_id: "<id>",
  oauth_client_secret: "<secret>",
  oidc_issuer_url: "<url>",
  oidc_client_id: "<id>",
  oidc_client_secret: "<secret>",
  oidc_allow_domains: ["<domain>"],
  oidc_allow_emails: ["<email>"],
  oidc_scopes: ["<scope>"],
  proxy_proto: "", // One of: "", "1", "2"
  request_header_remove: ["X-Req-Nope"],
  response_header_remove: ["X-Res-Nope"],
  request_header_add: ["X-Req-Yup:true"],
  response_header_add: ["X-Res-Yup:true"],
  schemes: ["HTTPS"],
  verify_webhook_provider: "twilio",
  verify_webhook_secret: "asdf",
  websocket_tcp_converter: true,
});
```

The [Config](https://ngrok.github.io/ngrok-nodejs/interfaces/Config.html) interface also shows all the available options.

# Examples

Degit can be used for cloning and running an example directory like this:
```bash
npx degit github:ngrok/ngrok-nodejs/examples/<example> <folder-name>
cd <folder-name>
npm i
```
For example:
```bash
npx degit github:ngrok/ngrok-nodejs/examples/express express && cd express && npm i
```

## Frameworks
* [AWS App Runner](https://aws.amazon.com/apprunner/) - See the [ngrok SDK Serverless Example](https://github.com/ngrok/ngrok-sdk-serverless-example) repository
* [Express](https://expressjs.com/) - [Quickstart Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/express/ngrok-express-quickstart.js), [Configuration Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/express/ngrok-express.js)
* [Fastify](https://www.fastify.io/) - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/fastify/ngrok-fastify.js)
* [Hapi](https://hapi.dev/) - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/hapi/ngrok-hapi.js)
* [Koa](https://koajs.com/) - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/koa/ngrok-koa.js)
* [Nest.js](https://nestjs.com/) - [Example main.ts](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/nestjs/src/main.ts)
* [Next.js](https://nextjs.org/) - [Example next.config.js](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/nextjs/next.config.js) loading [ngrok.config.js](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/nextjs/ngrok.config.js)
* [Remix](https://remix.run/) - [Example remix.config.js](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/remix/remix.config.js) loading [ngrok.config.js](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/remix/ngrok.config.js)
* [Svelte](https://svelte.dev/) - [Example svelte.config.js](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/svelte/svelte.config.js) (works in vite.config.js too) loading [ngrok.config.cjs](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/svelte/ngrok.config.cjs)
* [Typescript](https://www.typescriptlang.org/) - [Example ts-node](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-typescript.ts)
* [Vue](https://vuejs.org/) - [Example vite.config.ts](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/vue/vite.config.ts) loading [ngrok.config.ts](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/vue/ngrok.config.ts)
* [Winston](https://github.com/winstonjs/winston#readme) Logging - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-winston.js)

## Listener Types
* ngrok.connect - [ngrok.connect Minimal Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-connect-minimal.js), [Full ngrok.connect Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-connect-full.js)
* HTTP - [ngrok.listen Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-listen.js), [Minimal Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-http-minimum.js), [Full Configuration Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-http-full.js)
* Labeled - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-labeled.js)
* TCP - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-tcp.js)
* TLS - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-tls.js)
* Windows Pipe - [Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-windows-pipe.js)

# Builders

For more control over Sessions and Listeners, the builder classes can be used.

A minimal example using the builder class looks like [the following](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-http-minimum.js):

```jsx
async function create_listener() {
  const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
  const listener = await session.httpEndpoint().listen();
  console.log("Ingress established at:", listener.url());
  listener.forward("localhost:8081");
}
```

See here for a [Full Configuration Example](https://github.com/ngrok/ngrok-nodejs/blob/main/examples/ngrok-http-full.js)

## TLS Backends

As of version `0.7.0` there is backend TLS connection support, validated by a filepath specified in the `SSL_CERT_FILE` environment variable, or falling back to the host OS installed trusted certificate authorities. So it is now possible to do this to connect:

```jsx
await ngrok.connect({ addr: "https://127.0.0.1:3000", authtoken_from_env: true });
```

If the service is using certs not trusted by the OS, such as self-signed certificates, add an environment variable like this before running: `SSL_CERT_FILE=/path/to/ca.crt`.

# Async Programming

All methods return a `Promise` and are suitable for use in asynchronous
programming. You can use callback chaining with `.then()` and `.catch()` syntax
or the `await` keyword to wait for completion of an API call.

### Error Handling

The asynchronous functions will throw an error on failure to set up a session or listener,
which can be caught and dealt with using standard then/catch semantics.

```jsx
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect()
    .then((session) => {
        session.httpEndpoint().listen()
            .then((tun) => {})
            .catch(err => console.log('listener setup error: ' + err))
    })
    .catch(err => console.log('session setup error: ' + err))
    .await;
```

# Platform Support

Pre-built binaries are provided on NPM for the following platforms:

| OS         | i686 | x64 | aarch64 | arm |
| ---------- | -----|-----|---------|-----|
| Windows    |   ✓  |  ✓  |    *    |     |
| MacOS      |      |  ✓  |    ✓    |     |
| Linux      |      |  ✓  |    ✓    |  ✓  |
| Linux musl |      |  ✓  |    ✓    |     |
| FreeBSD    |      |  ✓  |         |     |
| Android    |      |     |    ✓    |  ✓  |

ngrok-nodejs, and [ngrok-rust](https://github.com/ngrok/ngrok-rust/) which it depends on, are open source, so it may be possible to build them for other platforms.

* Windows-aarch64 will be supported after the next release of [Ring](https://github.com/briansmith/ring/issues/1167).

# Dependencies

This project relies on [NAPI-RS](https://napi.rs/), an excellent system to ease development and building of Rust plugins for NodeJS.

# License

This project is licensed under either of

 * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or
   http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license ([LICENSE-MIT](LICENSE-MIT) or
   http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in ngrok-nodejs by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
