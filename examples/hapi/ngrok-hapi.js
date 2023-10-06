"use strict";

const Hapi = require("@hapi/hapi");
const ngrok = require("@ngrok/ngrok");

const init = async () => {
  const port = 3000;
  const server = Hapi.server({
    port: port,
    host: "localhost",
  });

  server.route({
    method: "GET",
    path: "/",
    handler: (request, h) => {
      return "Hello World!";
    },
  });

  await server.start();
  console.log("Server running on %s", server.info.uri);

  const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
  const listener = await session.httpEndpoint().listen();
  console.log(`Ingress established at: ${listener.url()}`);
  listener.forward(`localhost:${port}`);
};

process.on("unhandledRejection", (err) => {
  console.log(err);
  process.exit(1);
});

init();
