// Run with 'ts-node examples/ngrok-typescript.ts'

import * as http from "http";
const httpServer = http.createServer(
  function(req,res){res.writeHead(200);
  res.write('Hello');
  res.end();
} )
.listen(8081); 

import * as ngrok from "../index";

const run = async (): Promise<void> => {
  /*
  const tunnel = await ngrok.listen(httpServer);
  if ( typeof tunnel['url'] === 'function') {
    console.log("tunnel at: " + tunnel['url']());
  }
  */

  /*
  const socket = await ngrok.getSocket();
  httpServer.listen(socket);
  */

  const sessionBuilder = new ngrok.NgrokSessionBuilder().authtokenFromEnv()
  .handleStopCommand(() => {
    console.log("stop command");
  })
  .handleRestartCommand(() => {
    console.log("restart command");
  })
  .handleUpdateCommand((err, update) => {
    console.log("update command, version: " + update.version
      + " permitMajorVersion: " + update.permitMajorVersion);
  });
  const session = await sessionBuilder.connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log('tunnel at: ' + tunnel.url());
  tunnel.forwardTcp('localhost:8081');
}

run();
