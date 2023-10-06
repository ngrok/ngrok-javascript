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
builder = new ngrok.SessionBuilder();
builder.authtokenFromEnv().metadata("Online in One Line");

builder.connect().then((session) => {
  session
    .labeledListener()
    .label("edge", "edghts_<edge_id>")
    .metadata("example listener metadata from nodejs")
    .listen()
    .then((listener) => {
      console.log("Ingress established at: " + JSON.stringify(listener.labels()));
      listener.forward(UNIX_SOCKET);
    });
});

/*
ngrok.connect({
    addr: "unix:" + UNIX_SOCKET,
    authtoken_from_env: true,
    labels: "edge:edghts_<edge_id>",
    proto: "labeled",
});
*/
