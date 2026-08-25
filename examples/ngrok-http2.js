const http2 = require("node:http2");
const ngrok = require("@ngrok/ngrok");

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
  // create agent
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  // NOTE: setting the edge-facing L7 app protocol to http2 (previously
  // `.appProtocol("http2")`) is not currently exposed by this package.
  const endpoint = await agent.httpEndpoint().serve(server);
  console.log(`Ingress established at: ${endpoint.url()}`);
}

setup();
