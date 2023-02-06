const http = require('http');
http.createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} ).listen(8081); 

var ngrok = require('@ngrok/ngrok');
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect().then((session) => {
  http.ngrok_session = session; // prevent garbage collection
  session.httpEndpoint().listen().then((tunnel) => {
    http.tunnel = tunnel; // prevent garbage collection
    console.log('tunnel at: ' + tunnel.url());
    tunnel.forwardTcp('localhost:8081');
  })
}).await;
