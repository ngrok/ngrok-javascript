"use strict";
const ngrok = require("@ngrok/ngrok");
const fastify = require("fastify")({
  logger: true,
  http2: true,
});

fastify.get("/", function (request, reply) {
  reply.code(200).send({ hello: "world" });
});

// Run the server!
const start = async () => {
  try {
    const port = 3000;
    await fastify.listen({ port: port });

    // Establish ingress
    const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
    const listener = await session.httpEndpoint().appProtocol("http2").listen();
    listener.forward(`localhost:${port}`);
    fastify.log.info(`Ingress established at: ${listener.url()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
