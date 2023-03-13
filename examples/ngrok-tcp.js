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
builder = new ngrok.NgrokSessionBuilder();
builder.authtokenFromEnv()
  .metadata("Online in One Line");

var global_tunnel;
builder.connect().then((session) => {
  session.tcpEndpoint()
    // .allowCidr("0.0.0.0/0")
    // .denyCidr("10.1.1.1/32")
    // .forwardsTo("example nodejs")
    // .proxyProto("") // One of: "", "1", "2"
    // .remoteAddr("<n>.tcp.ngrok.io:<p>")
    .metadata("example tunnel metadata from nodejs")
    .listen().then((tunnel) => {
      console.log("established tunnel at: " + tunnel.url())
      tunnel.forwardPipe(UNIX_SOCKET);
  })
});
