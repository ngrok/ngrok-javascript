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
console.log("Node.js web server at localhost:" + PORT + " is running...");

// setup ngrok
const ngrok = require("@ngrok/ngrok");
builder = new ngrok.AgentBuilder();
builder.authtokenFromEnv().metadata("Online in One Line");

builder.connect().then((agent) => {
  agent
    .tcpEndpoint()
    // .remoteAddr("<n>.tcp.ngrok.io:<p>")
    // .trafficPolicy(myPolicyYaml) // e.g. a restrict-ips action on on_tcp_connect
    .metadata("example endpoint metadata from nodejs")
    .forward(`localhost:${PORT}`)
    .then((endpoint) => {
      console.log("Ingress established at:", endpoint.url());
    });
});
