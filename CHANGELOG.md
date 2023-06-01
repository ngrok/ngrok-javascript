## 0.5.2:

* Cleanly return from a tunnel forward call after a `session.close()`

## 0.5.1:

* `consoleLog` return signature

## 0.5.0:

* Add `NgrokSession.clientInfo()`
* Rename to `ngrok-nodejs`

## 0.4.1:

* Clean shutdown when run from npm
* Unblock Svelte postinstall script

## 0.4.0:

* Move to a single tunnel type for simplicity
* Documentation updates

## 0.3.0:

* Added `ngrok.connect(Config)`, `ngrok.authtoken()`, and `ngrok.disconnect(url)`
* Examples cleanup

## 0.2.0:

* Now have examples for Express, Fastify, Hapi, Koa, Nest.js, Next.js, Remix, Svelte, and Vue.
* Add `prettier` auto code formatting.

## 0.1.1:

* Bump `ngrok-rust` to `0.11.3`.
* Migrate `ca_cert` to the upstream call in `ngrok-rust`.

## 0.1.0:

* Added `ca_cert`, `handle_heartbeat`, and `handle_disconnection` to NgrokSession.

## 0.0.12:

* Added NgrokSession.close().
* Cleanly shutdown when listen is called with a pre-configured tunnel.

## 0.0.11:

* Cleanly shutdown on all platforms when there are callbacks registered.

## 0.0.10:

* Child client versioning support.

## 0.0.9:

* Support for named pipes on Windows.

## 0.0.8:

* Support callbacks for logging, include console.log and Winston handlers.
* Can now pass tunnels directly to net.Server.listen().
* Clean shutdown on SIGINT after ngrok.listen(server).
* Typedoc generation of documentation.

## 0.0.7:

* Improved memory management, removing need to keep NodeJS from garbage collecting certain objects.
* Support callbacks for remote operations (stop, restart, update).
* Typescript support for getSocket and listen.

## 0.0.6:

* Initial public release
