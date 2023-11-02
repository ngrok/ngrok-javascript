const server = require("http").createServer(function (req, res) {
  res.writeHead(200).write("Hello");
  res.end();
});

const ngrok = require("@ngrok/ngrok");

(async function () {
  await ngrok.listen(server);
  console.log(`Ingress established at: ${server.listener.url()}`);
})();
