const server = require("http").createServer(function (req, res) {
  res.writeHead(200).write("Hello");
  res.end();
});

const ngrok = require("@ngrok/ngrok");

(async function () {
  const endpoint = await ngrok.listen(server);
  console.log(`Ingress established at: ${endpoint.url()}`);
})();
