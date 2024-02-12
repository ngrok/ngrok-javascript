const ngrok = require("../index.js");
const http2 = require("node:http2");

const server = http2.createServer();
server.on("error", (err) => console.error(err));

server.on("stream", (stream, headers) => {
  // stream is a Duplex
  stream.respond({
    "content-type": "text/html; charset=utf-8",
    ":status": 200,
  });
  stream.end("<h1>Hello World</h1>");
});

async function setup() {
  // create session
  const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
  // create listener
  const listener = await session.httpEndpoint().appProtocol("http2").listen();

  await ngrok.listen(server, listener);
  console.log(`Ingress established at: ${listener.url()}`);
  console.log(`Server listening on: ${socket.address()}`);
}

setup();
