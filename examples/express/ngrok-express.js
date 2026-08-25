const express = require("express");
const ngrok = require("@ngrok/ngrok");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

// Restrictions, headers, auth, etc. that used to be chained builder methods
// (.allowCidr()/.oauth()/.requestHeader()/...) are now expressed as a Traffic Policy
// document. See https://ngrok.com/docs/traffic-policy/.
const trafficPolicy = `
on_http_request:
  - actions:
      - type: restrict-ips
        config:
          enforce: true
          allow:
            - 0.0.0.0/0
      - type: add-headers
        config:
          headers:
            x-req-yup: "true"
`;

async function setup() {
  // create agent
  const agent = await new ngrok.AgentBuilder()
    .authtokenFromEnv()
    .metadata("Online in One Line")
    .connect();
  // build an endpoint and serve this express app on it directly
  const endpoint = await agent.httpEndpoint().trafficPolicy(trafficPolicy).serve(app);
  console.log(`Ingress established at: ${endpoint.url()}`);
}

setup();
