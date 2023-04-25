const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(8081);

var ngrok = require("@ngrok/ngrok");
new ngrok.NgrokSessionBuilder()
  .authtokenFromEnv()
  .connect()
  .then((session) => {
    session
      .httpEndpoint()
      .listen()
      .then((tunnel) => {
        console.log("Ingress established at:", tunnel.url());
        tunnel.forwardTcp("localhost:8081");
      });
  });
