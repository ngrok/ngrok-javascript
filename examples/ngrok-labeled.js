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
ngrok.consoleLog("INFO");
builder = new ngrok.NgrokSessionBuilder();
builder.authtokenFromEnv().metadata("Online in One Line");

builder.connect().then((session) => {
  session
    .labeledTunnel()
    .label("edge", "edghts_<edge_id>")
    .metadata("example tunnel metadata from nodejs")
    .listen()
    .then((tunnel) => {
      console.log("Ingress established at: " + JSON.stringify(tunnel.labels()));
      tunnel.forwardPipe(UNIX_SOCKET);
    });
});

/*
ngrok.connect({
    addr: "pipe:" + UNIX_SOCKET,
    authtoken_from_env: true,
    labels: "edge:edghts_<edge_id>",
    proto: "labeled",
});
*/
