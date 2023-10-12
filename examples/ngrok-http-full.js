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
// import ngrok from '@ngrok/ngrok' // if inside a module
ngrok.consoleLog("INFO"); // turn on info logging

builder = new ngrok.SessionBuilder();
builder
  // .authtoken("<authtoken>")
  .authtokenFromEnv()
  .metadata("Online in One Line")
  .clientInfo("ngrok-http-full", "1.2.3")
  // .caCert(fs.readFileSync('ca.crt'))
  // .serverAddr('192.168.1.1:443')
  .handleStopCommand(() => {
    console.log("stop command");
  })
  .handleRestartCommand(() => {
    console.log("restart command");
  })
  .handleUpdateCommand((update) => {
    console.log(
      "update command, version:",
      update.version,
      "permitMajorVersion:",
      update.permitMajorVersion
    );
  })
  .handleHeartbeat((latency) => {
    console.log("heartbeat, latency:", latency, "milliseconds");
  })
  .handleDisconnection((addr, error) => {
    console.log("disconnected, addr:", addr, "error:", error);
  });

builder.connect().then((session) => {
  session
    .httpEndpoint()
    // .allowCidr("0.0.0.0/0")
    // .allowUserAgent("^mozilla.*")
    // .basicAuth("ngrok", "online1line")
    // .circuitBreaker(0.5)
    // .compression()
    // .denyCidr("10.1.1.1/32")
    // .denyUserAgent("^curl.*")
    // .domain("<somedomain>.ngrok.io")
    // .mutualTlsca(fs.readFileSync('ca.crt'))
    // .oauth("google", ["<user>@<domain>"], ["<domain>"])
    // .oauth("google", ["<user>@<domain>"], ["<domain>"], ["<scope>"], "<id>", "<secret>")
    // .oidc("<url>", "<id>", "<secret>", ["<user>@<domain>"], ["<domain>"], ["<scope>"])
    // .proxyProto("") // One of: "", "1", "2"
    // .removeRequestHeader("X-Req-Nope")
    // .removeResponseHeader("X-Res-Nope")
    // .requestHeader("X-Req-Yup", "true")
    // .responseHeader("X-Res-Yup", "true")
    // .scheme("HTTPS")
    // .websocketTcpConversion()
    // .webhookVerification("twilio", "asdf")
    .metadata("example listener metadata from nodejs")
    .listen()
    .then((listener) => {
      console.log("Ingress established at:", listener.url());
      listener.forward(UNIX_SOCKET);
    });
});
