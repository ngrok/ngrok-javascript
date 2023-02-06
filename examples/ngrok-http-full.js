var UNIX_SOCKET = "/tmp/http.socket";
const fs = require('fs');
fs.unlinkSync(UNIX_SOCKET);

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
builder = new ngrok.NgrokSessionBuilder();
builder
  // .authtoken("<authtoken>")
  .authtokenFromEnv()
  .metadata("Online in One Line");

builder.connect().then((session) => {
  http.ngrok_session = session; // prevent garbage collection
  session.httpEndpoint()
    // .allowCidrString("0.0.0.0/0")
    // .basicAuth("ngrok", "online1line")
    // .circuitBreaker(0.5)
    // .compression()
    // .denyCidrString("10.1.1.1/32")
    // .domain("<somedomain>.ngrok.io")
    // .mutualTlsca(fs.readFileSync('domain.crt'))
    // .oauth("google", ["<user>@<domain>"], ["<domain>"], ["<scope>"])
    // .oidc("<url>", "<id>", "<secret>", ["<user>@<domain>"], ["<domain>"], ["<scope>"])
    // .proxyProto("") // One of: "", "V1", "V2"
    // .removeRequestHeader("X-Req-Nope")
    // .removeResponseHeader("X-Res-Nope")
    // .requestHeader("X-Req-Yup", "true")
    // .responseHeader("X-Res-Yup", "true")
    // .scheme("HTTPS")
    // .websocketTcpConversion()
    // .webhookVerification("twilio", "asdf"),
    .metadata("example tunnel metadata from nodejs")
    .listen().then((tunnel) => {
      http.tunnel = tunnel; // prevent garbage collection
      console.log("established tunnel at: " + tunnel.url())
      tunnel.forwardUnix(UNIX_SOCKET);
  })
}).await;
