const server = require("http").createServer(function (req, res) {
  res.writeHead(200);
  res.write("Hello");
  res.end();
});

var ngrok = require("@ngrok/ngrok");

ngrok.listen(server).then(() => {
  console.log("url: " + server.tunnel.url());
});
