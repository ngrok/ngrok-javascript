const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var host = "localhost";
var port = "5173";
process.argv.forEach((item, index) => {
  if (item == "--host") host = process.argv[index + 1];
  if (item == "--port") port = process.argv[index + 1];
});

async function setup() {
  const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log(`Forwarding to: ${host}:${port} from ingress at: ${tunnel.url()}`);
  tunnel.forwardTcp(`${host}:${port}`);
}

setup();
