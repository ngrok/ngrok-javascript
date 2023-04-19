const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var port = process.env.PORT || "3000";
process.argv.forEach((item, index) => {
  if (["--port", "-p"].includes(item)) port = process.argv[index + 1];
});

async function setup() {
  const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log(`Forwarding to: localhost:${port} from ingress at: ${tunnel.url()}`);
  tunnel.forwardTcp(`localhost:${port}`);
}

setup();
