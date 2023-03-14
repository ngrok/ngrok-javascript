var UNIX_SOCKET = "/tmp/http.socket";
const fs = require('fs');
try{fs.unlinkSync(UNIX_SOCKET)} catch {}

// make webserver
var http = require('http'); 
http.createServer(function (req, res) {
  res.writeHead(200, {'Content-Type': 'text/html'}); 
  res.write('Congrats you have a created an ngrok web server');
  res.end();
})
.listen(UNIX_SOCKET); // Server object listens on unix socket
console.log('Node.js web server at ' + UNIX_SOCKET + ' is running..');

// setup ngrok
var ngrok = require('@ngrok/ngrok');
// import ngrok from '@ngrok/ngrok' // if inside a module
ngrok.consoleLog(); // turn on debug logging
builder = new ngrok.NgrokSessionBuilder();
builder
  // .authtoken("<authtoken>")
  .authtokenFromEnv()
  .metadata("Online in One Line")
  .handleStopCommand(() => {
    console.log("stop command");
  })
  .handleRestartCommand(() => {
    console.log("restart command");
  })
  .handleUpdateCommand((update) => {
    console.log("update command, version: " + update.version
      + " permitMajorVersion: " + update.permitMajorVersion);
  });

builder.connect().then((session) => {
  session.httpEndpoint()
    // .allowCidr("0.0.0.0/0")
    // .basicAuth("ngrok", "online1line")
    // .circuitBreaker(0.5)
    // .compression()
    // .denyCidr("10.1.1.1/32")
    // .domain("<somedomain>.ngrok.io")
    // .mutualTlsca(fs.readFileSync('ca.crt'))
    // .oauth("google", ["<user>@<domain>"], ["<domain>"], ["<scope>"])
    // .oidc("<url>", "<id>", "<secret>", ["<user>@<domain>"], ["<domain>"], ["<scope>"])
    // .proxyProto("") // One of: "", "1", "2"
    // .removeRequestHeader("X-Req-Nope")
    // .removeResponseHeader("X-Res-Nope")
    // .requestHeader("X-Req-Yup", "true")
    // .responseHeader("X-Res-Yup", "true")
    // .scheme("HTTPS")
    // .websocketTcpConversion()
    // .webhookVerification("twilio", "asdf")
    .metadata("example tunnel metadata from nodejs")
    .listen().then((tunnel) => {
      console.log("established tunnel at: " + tunnel.url())
      tunnel.forwardPipe(UNIX_SOCKET);
  })
});
