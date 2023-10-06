const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(8081);

var ngrok = require("@ngrok/ngrok");

async function create_listener() {
  const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
  const listener = await session.httpEndpoint().listen();
  console.log("Ingress established at:", listener.url());
  listener.forward("localhost:8081");
}
create_listener();
