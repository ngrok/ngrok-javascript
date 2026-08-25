// Run with 'ts-node ngrok-typescript.ts'

import * as http from "http";
const httpServer = http.createServer(function (req, res) {
  res.writeHead(200);
  res.write("Hello");
  res.end();
});

import * as ngrok from "@ngrok/ngrok";
ngrok.consoleLog();

const run = async (): Promise<void> => {
  // await listenServer();
  // await forwardExisting();
  await standardConfig();
};

async function listenServer() {
  const endpoint = await ngrok.listen(httpServer);
  console.log("Ingress established at: ", endpoint.url());
}

async function forwardExisting() {
  const agentBuilder = new ngrok.AgentBuilder().authtokenFromEnv();
  const agent = await agentBuilder.connect();
  httpServer.listen(8081);
  const endpoint = await agent.httpEndpoint().forward("localhost:8081");
  console.log("Ingress established at:", endpoint.url());
}

async function standardConfig() {
  ngrok.loggingCallback(function (level, target, message) {
    console.log(level, target, "-", message);
  });
  const agentBuilder = new ngrok.AgentBuilder()
    .authtokenFromEnv()
    .onRpc((request) => {
      // request.method is one of "stop", "restart", "update"
      console.log("agent rpc request:", request.method);
    });
  const agent = await agentBuilder.connect();
  httpServer.listen(8081);
  const endpoint = await agent.httpEndpoint().forward("localhost:8081");
  console.log("Ingress established at:", endpoint.url());

  // unregister logging callback
  ngrok.loggingCallback();
}

run();
