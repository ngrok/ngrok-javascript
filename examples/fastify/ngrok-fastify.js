// Require the framework and instantiate it
const fastify = require("fastify")({ logger: true });
const ngrok = require("@ngrok/ngrok");

// Declare a route
fastify.get("/", async (request, reply) => {
  return { hello: "world" };
});

// Run the server!
const start = async () => {
  try {
    const port = 3000;
    await fastify.listen({ port: port });

    // Establish ingress
    const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
    const listener = await session.httpEndpoint().listen();
    listener.forward(`localhost:${port}`);
    fastify.log.info(`Ingress established at: ${listener.url()}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};
start();
