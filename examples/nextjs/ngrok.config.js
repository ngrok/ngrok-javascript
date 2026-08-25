const ngrok = require("@ngrok/ngrok");

// setup ngrok ingress in the parent process,
// in forked processes "send" will exist.
const makeEndpoint = process.send === undefined;
var host = "localhost";
var port = process.env.PORT || "3000";

process.argv.forEach((item, index) => {
  if (["--hostname", "-H"].includes(item)) host = process.argv[index + 1];
  if (["--port", "-p"].includes(item)) port = process.argv[index + 1];
});

async function setup() {
  const agent = await new ngrok.AgentBuilder().authtokenFromEnv().connect();
  const endpoint = await agent.httpEndpoint().forward(`${host}:${port}`);
  console.log(`Forwarding to: ${host}:${port} from ingress at: ${endpoint.url()}`);
}

if (makeEndpoint) setup();
