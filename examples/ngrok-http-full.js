const PORT = 8080;

// make webserver
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("Congrats you have a created an ngrok web server");
    res.end();
  })
  .listen(PORT);
console.log("Node.js web server at localhost:" + PORT + " is running..");

// setup ngrok
const ngrok = require("@ngrok/ngrok");
// import ngrok from '@ngrok/ngrok' // if inside a module
ngrok.consoleLog("INFO"); // turn on info logging

builder = new ngrok.AgentBuilder();
builder
  // .authtoken("<authtoken>")
  .authtokenFromEnv()
  .metadata("Online in One Line")
  .clientInfo("ngrok-http-full", "1.2.3")
  // .connectCaCert(fs.readFileSync('ca.crt'))
  // .connectUrl('192.168.1.1:443')
  // .proxyUrl('http://localhost:8888')
  .onRpc((request) => {
    // request.method is one of "stop", "restart", "update"
    console.log("agent rpc request:", request.method);
  })
  .onEvent((event) => {
    // event.kind is one of "connectSucceeded", "disconnected", "heartbeatReceived",
    // "connectionOpened", "connectionClosed", "httpRequestComplete"
    console.log("agent event:", event.kind, event);
  });

// Most of what used to be discrete builder methods (basic auth, OAuth/OIDC, webhook
// verification, circuit breaker, compression, IP restrictions, header add/remove,
// mutual TLS, ...) are now expressed as a Traffic Policy document evaluated at the
// ngrok edge. See https://ngrok.com/docs/traffic-policy/ for the full action list.
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

builder.connect().then((agent) => {
  agent
    .httpEndpoint()
    // .domain("<somedomain>.ngrok.io")
    .trafficPolicy(trafficPolicy)
    .metadata("example endpoint metadata from nodejs")
    .forward(`localhost:${PORT}`, {
      // upstreamProtocol: "http2",
      // verifyUpstreamTls: false, // set false for self-signed local HTTPS backends
      // proxyProto: "", // One of: "", "1", "2"
    })
    .then((endpoint) => {
      console.log("Ingress established at:", endpoint.url());
    });
});
