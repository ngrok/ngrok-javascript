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
  // await listenable();
  // await listen();
  await standardConfig();
};

async function listenServer() {
  const listener = await ngrok.listen(httpServer);
  if (typeof listener["url"] === "function") {
    console.log("Ingress established at: ", listener["url"]());
  }
}

async function listenable() {
  const listener = await ngrok.listenable();
  httpServer.listen(listener);
}

async function listen() {
  const sessionBuilder = new ngrok.SessionBuilder().authtokenFromEnv();
  const session = await sessionBuilder.connect();
  const listener = await session.httpEndpoint().listen();
  httpServer.listen(listener);
}

async function standardConfig() {
  ngrok.loggingCallback(function (level, target, message) {
    console.log(level, target, "-", message);
  });
  const sessionBuilder = new ngrok.SessionBuilder()
    .authtokenFromEnv()
    .handleStopCommand(() => {
      console.log("stop command");
    })
    .handleRestartCommand(() => {
      console.log("restart command");
    })
    .handleUpdateCommand((update) => {
      console.log(
        "update command, version: " +
          update.version +
          " permitMajorVersion: " +
          update.permitMajorVersion
      );
    });
  const session = await sessionBuilder.connect();
  const listener = await session.httpEndpoint().listen();
  console.log("Ingress established at:", listener.url());
  httpServer.listen(8081);
  listener.forward("localhost:8081");

  // unregister logging callback
  ngrok.loggingCallback();
}

run();
