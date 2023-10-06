const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var port = process.env.PORT || "3000";
process.argv.forEach((item, index) => {
  if (["--port", "-p"].includes(item)) port = process.argv[index + 1];
});

async function setup() {
  const session = await new ngrok.SessionBuilder().authtokenFromEnv().connect();
  const listener = await session.httpEndpoint().listen();
  console.log(`Forwarding to: localhost:${port} from ingress at: ${listener.url()}`);
  listener.forward(`localhost:${port}`);
}

setup();
