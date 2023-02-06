# ngrok-js

[![npm.rs][npm-badge]][npm-url]
[![MIT licensed][mit-badge]][mit-url]
[![Apache-2.0 licensed][apache-badge]][apache-url]
[![Continuous integration][ci-badge]][ci-url]

[npm-badge]: https://img.shields.io/npm/v/@ngrok/ngrok.svg
[npm-url]: https://www.npmjs.com/package/@ngrok/ngrok
[mit-badge]: https://img.shields.io/badge/license-MIT-blue.svg
[mit-url]: https://github.com/ngrok/ngrok-rs/blob/main/LICENSE-MIT
[apache-badge]: https://img.shields.io/badge/license-Apache_2.0-blue.svg
[apache-url]: https://github.com/ngrok/ngrok-rs/blob/main/LICENSE-APACHE
[ci-badge]: https://github.com/ngrok/ngrok-js/actions/workflows/ci.yml/badge.svg
[ci-url]: https://github.com/ngrok/ngrok-js/actions/workflows/ci.yml

[Website](https://ngrok.com)

**Note: This is alpha-quality software. Interfaces are subject to change without warning.**

ngrok is a globally distributed reverse proxy commonly used for quickly getting a public URL to a
service running inside a private network, such as on your local laptop. The ngrok agent is usually
deployed inside a private network and is used to communicate with the ngrok cloud service.

This is the ngrok agent in library form, suitable for integrating directly into NodeJS
applications. This allows you to quickly build ngrok into your application with no separate process
to manage.

# Installation

The published library is available on
[npm](https://www.npmjs.com/package/@ngrok/ngrok).

```shell
npm install @ngrok/ngrok
```

# Quickstart

After you've installed the package, you'll need an Auth Token. Retrieve one on the
[Auth Token page of your ngrok dashboard](https://dashboard.ngrok.com/get-started/your-authtoken)

There are multiple examples in [the /examples directory](https://github.com/ngrok/ngrok-js/tree/main/examples).
A minimal use-case looks like the following:

```jsx
const server = require('http').createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} );

var ngrok = require('@ngrok/ngrok');

ngrok.listen(server).then(() => {
  console.log("url: " + server.tunnel.url());
});
```

### Async Programming

All methods return a `Promise` and are suitable for use in asynchronous
programming. You can use callback chaining with `.then()` and `.catch()` syntax
or the `await` keyword to wait for completion of an API call.

### Error Handling

The asynchronous functions will throw an error on failure to set up a session or tunnel,
which can be caught and dealt with using standard then/catch semantics.

```jsx
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect()
    .then((session) => {
        session.httpEndpoint().listen()
            .then((tun) => {})
            .catch(err => console.log('tunnel setup error: ' + err))
    })
    .catch(err => console.log('session setup error: ' + err))
    .await;
```

# License

This project is licensed under either of

 * Apache License, Version 2.0, ([LICENSE-APACHE](LICENSE-APACHE) or
   http://www.apache.org/licenses/LICENSE-2.0)
 * MIT license ([LICENSE-MIT](LICENSE-MIT) or
   http://opensource.org/licenses/MIT)

at your option.

### Contribution

Unless you explicitly state otherwise, any contribution intentionally submitted
for inclusion in tokio-core by you, as defined in the Apache-2.0 license, shall be
dual licensed as above, without any additional terms or conditions.
