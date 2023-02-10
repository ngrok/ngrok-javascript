const server = require('http').createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} );

const ngrok = require('@ngrok/ngrok')
ngrok.getSocket().then((socket) => {
  console.log("tunnel url: " + socket.tunnel.url());
  server.listen(socket);
});

