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
