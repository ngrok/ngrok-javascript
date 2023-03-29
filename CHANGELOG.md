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
