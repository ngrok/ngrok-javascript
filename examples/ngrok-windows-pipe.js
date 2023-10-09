const PIPE = "\\\\.\\pipe\\ngrok_pipe";

const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(PIPE);

const ngrok = require("@ngrok/ngrok");
ngrok.consoleLog(); // turn on info logging
new ngrok.SessionBuilder()
  .authtokenFromEnv()
  .connect()
  .then((session) => {
    session
      .httpEndpoint()
      .listen()
      .then((listener) => {
        console.log("Ingress established at:", listener.url());
        listener.forward(PIPE);
      });
  });
