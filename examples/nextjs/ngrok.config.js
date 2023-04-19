const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var makeTunnel = true;
var host = "localhost";
var port = process.env.PORT || "3000";

process.argv.forEach((item, index) => {
  // The first process to configure is a child which runs building, then the parent
  // configures later, so use arguments rather than environment variable to run once.
  if (item.includes("processChild")) makeTunnel = false;
  if (["--hostname", "-H"].includes(item)) host = process.argv[index + 1];
  if (["--port", "-p"].includes(item)) port = process.argv[index + 1];
});

async function setup() {
  const session = await new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect();
  const tunnel = await session.httpEndpoint().listen();
  console.log(`Forwarding to: ${host}:${port} from ingress at: ${tunnel.url()}`);
  tunnel.forwardTcp(`${host}:${port}`);
}

if (makeTunnel) setup();
