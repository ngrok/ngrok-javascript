const http = require('http');
http.createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} ).listen(8081); 

var ngrok = require('..');
ngrok.consoleLog("DEBUG");
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect().then((session) => {
  session.httpEndpoint().listenAndForward('tcp://localhost:8081').then((tunnel) => {
    console.log('tunnel at: ' + tunnel.url());
  })
});
