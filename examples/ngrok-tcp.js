const UNIX_SOCKET = "/tmp/http.socket";
const fs = require("fs");
try {
  fs.unlinkSync(UNIX_SOCKET);
} catch {}

// make webserver
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("Congrats you have a created an ngrok web server");
    res.end();
  })
  .listen(UNIX_SOCKET); // Server object listens on unix socket
console.log("Node.js web server at", UNIX_SOCKET, "is running..");

// setup ngrok
const ngrok = require("@ngrok/ngrok");
builder = new ngrok.SessionBuilder();
builder.authtokenFromEnv().metadata("Online in One Line");

builder.connect().then((session) => {
  session
    .tcpEndpoint()
    // .allowCidr("0.0.0.0/0")
    // .denyCidr("10.1.1.1/32")
    // .forwardsTo("example nodejs")
    // .proxyProto("") // One of: "", "1", "2"
    // .remoteAddr("<n>.tcp.ngrok.io:<p>")
    .metadata("example listener metadata from nodejs")
    .listen()
    .then((listener) => {
      console.log("Ingress established at:", listener.url());
      listener.forward(UNIX_SOCKET);
    });
});
