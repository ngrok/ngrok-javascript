const express = require('express')
const ngrok = require('@ngrok/ngrok')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World!')
})

async function setup() {
  // create session
  const session = await new ngrok.NgrokSessionBuilder()
    .authtokenFromEnv()
    .metadata("Online in One Line")
    .connect();
  // create tunnel
  const tunnel = await session.httpEndpoint()
    .allowCidr("0.0.0.0/0")
    .oauth("google")
    .requestHeader("X-Req-Yup", "true")
    .listen();
  console.log("tunnel established at: " + tunnel.url());
  // link tunnel to app
  ngrok.listen(app, tunnel)
}

setup();
