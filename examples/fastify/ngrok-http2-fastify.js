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
    // NOTE: setting the edge-facing L7 app protocol to http2 (previously
    // `.appProtocol("http2")`) is not currently exposed by this package.
    const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
    const endpoint = await agent.httpEndpoint().forward(`localhost:${port}`);
    fastify.log.info(`Ingress established at: ${endpoint.url()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
