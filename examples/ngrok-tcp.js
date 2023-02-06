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

var global_tunnel;
builder.connect().then((session) => {
  http.ngrok_session = session; // prevent garbage collection
  session.tcpEndpoint()
    // .allowCidrString("0.0.0.0/0")
    // .denyCidrString("10.1.1.1/32")
    // .forwardsTo("example nodejs")
    // .proxyProto("") // One of: "", "V1", "V2"
    // .remoteAddr("<n>.tcp.ngrok.io:<p>")
    .metadata("example tunnel metadata from nodejs")
    .listen().then((tunnel) => {
      http.tunnel = tunnel; // prevent garbage collection
      console.log("established tunnel at: " + tunnel.url())
      tunnel.forwardUnix(UNIX_SOCKET);
  })
}).await;
