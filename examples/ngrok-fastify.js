// Require the framework and instantiate it
const fastify = require('fastify')({ logger: true })

// Declare a route
fastify.get('/', async (request, reply) => {
  return { hello: 'world' }
})

// Establish ingress
var ngrok = require('@ngrok/ngrok');
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect().then((session) => {
  session.httpEndpoint().listen().then((tunnel) => {
    console.log('Ingress at: ' + tunnel.url());
    tunnel.forwardTcp('localhost:3000');
  })
});

// Run the server!
const start = async () => {
  try {
    await fastify.listen({ port: 3000 })
  } catch (err) {
    fastify.log.error(err)
    process.exit(1)
  }
}
start()
