const PORT = 8080;

// make webserver
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("Congrats you have a created an ngrok web server");
    res.end();
  })
  .listen(PORT);
console.log("Node.js web server at localhost:" + PORT + " is running..");

// setup ngrok
const ngrok = require("@ngrok/ngrok");
builder = new ngrok.AgentBuilder();
builder.authtokenFromEnv().metadata("Online in One Line");

builder.connect().then((agent) => {
  console.log("established agent connection");
  agent
    .tlsEndpoint()
    // .domain("<somedomain>.ngrok.io")
    // NOTE: custom TLS termination at the edge (previously `.termination(cert, key)`)
    // is not currently exposed by this package -- see README for details.
    .metadata("example endpoint metadata from nodejs")
    .forward(`localhost:${PORT}`)
    .then((endpoint) => {
      console.log("Ingress established at:", endpoint.url());
    });
});
