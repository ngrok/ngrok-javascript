const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process
var host = "localhost";
var port = "5173";
process.argv.forEach((item, index) => {
  if (item == "--host") host = process.argv[index + 1];
  if (item == "--port") port = process.argv[index + 1];
});

async function setup() {
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward(`${host}:${port}`);
  console.log(`Forwarding to: ${host}:${port} from ingress at: ${endpoint.url()}`);
}

setup();
