const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var port = process.env.PORT || "3000";
process.argv.forEach((item, index) => {
  if (["--port", "-p"].includes(item)) port = process.argv[index + 1];
});

async function setup() {
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward(`localhost:${port}`);
  console.log(`Forwarding to: localhost:${port} from ingress at: ${endpoint.url()}`);
}

setup();
