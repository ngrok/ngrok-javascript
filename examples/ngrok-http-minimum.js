const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(8081);

var ngrok = require("@ngrok/ngrok");

async function create_endpoint() {
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward("localhost:8081");
  console.log("Ingress established at:", endpoint.url());
}
create_endpoint();
