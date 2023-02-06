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
builder.authtokenFromEnv()
  .metadata("Online in One Line");

builder.connect().then((session) => {
  http.ngrok_session = session; // prevent garbage collection
  console.log("established session");
  session.tlsEndpoint()
    // .allowCidrString("0.0.0.0/0")
    // .denyCidrString("10.1.1.1/32")
    // .domain("<somedomain>.ngrok.io")
    // .forwardsTo("example nodejs")
    // .mutualTlsca(fs.readFileSync('ca.crt'))
    // .proxyProto("") // One of: "", "V1", "V2"
    // .remoteAddr("<n>.tcp.ngrok.io:<p>")
    .certPem(fs.readFileSync('domain.crt'))
    .keyPem(fs.readFileSync('domain.key'))
    .metadata("example tunnel metadata from nodejs")
    .listen().then((tunnel) => {
      http.tunnel = tunnel; // prevent garbage collection
      console.log("established tunnel at: " + tunnel.url())
      tunnel.forwardUnix(UNIX_SOCKET);
  })
}).await;
