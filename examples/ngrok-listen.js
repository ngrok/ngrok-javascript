const server = require("http").createServer(function (req, res) {
  res.writeHead(200);
  res.write("Hello");
  res.end();
});

const ngrok = require("@ngrok/ngrok");

ngrok.listen(server).then(() => {
  console.log("Ingress established at:", server.listener.url());
});
