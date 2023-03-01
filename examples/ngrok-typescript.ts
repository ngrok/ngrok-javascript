// Run with 'ts-node examples/ngrok-typescript.ts'

import * as http from "http";
const httpServer = http.createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} );

import * as ngrok from "../index";
ngrok.consoleLog();

const run = async (): Promise<void> => {
  // await listenServer();
  // await listenable();
  // await bind();
  await standardConfig();
}

async function listenServer() {
  const tunnel = await ngrok.listen(httpServer);
  if ( typeof tunnel['url'] === 'function') {
    console.log("tunnel at: " + tunnel['url']());
  }
}

async function listenable() {
  const tunnel = await ngrok.listenable();
  httpServer.listen(tunnel);
}

async function bind() {
  const sessionBuilder = new ngrok.NgrokSessionBuilder().authtokenFromEnv()
  const session = await sessionBuilder.connect();
  const tunnel = await session.httpEndpoint().bind();
  httpServer.listen(tunnel); 
}

async function standardConfig() {
  ngrok.loggingCallback(function(level, target, message) {
    console.log(`${level} ${target} - ${message}`);
  });
  const sessionBuilder = new ngrok.NgrokSessionBuilder().authtokenFromEnv()
  .handleStopCommand(() => {
    console.log("stop command");
  })
  .handleRestartCommand(() => {
    console.log("restart command");
  })
  .handleUpdateCommand((update) => {
    console.log("update command, version: " + update.version
      + " permitMajorVersion: " + update.permitMajorVersion);
  });
  const session = await sessionBuilder.connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log('tunnel at: ' + tunnel.url());
  httpServer.listen(8081); 
  tunnel.forwardTcp('localhost:8081');

  // unregister logging callback
  ngrok.loggingCallback();
}

run();
