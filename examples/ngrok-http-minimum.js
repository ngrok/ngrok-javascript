const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(8081);

var ngrok = require("@ngrok/ngrok");

async function create_tunnel() {
  const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log("Ingress established at:", tunnel.url());
  tunnel.forwardTcp("localhost:8081");
}
create_tunnel();
