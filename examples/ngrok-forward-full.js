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
console.log(`Node.js web server at localhost:${PORT} is running..`);

// setup ngrok
const ngrok = require("@ngrok/ngrok");
ngrok.consoleLog("INFO"); // turn on info logging

// Most of what used to be discrete config fields (basic auth, OAuth/OIDC, webhook
// verification, circuit breaker, compression, IP restrictions, header add/remove,
// mutual TLS, ...) are now expressed as a Traffic Policy document evaluated at the
// ngrok edge. See https://ngrok.com/docs/traffic-policy/ for the full action list.
const trafficPolicy = `
on_http_request:
  - actions:
      - type: basic-auth
        config:
          credentials:
            - ngrok:online1line
      - type: restrict-ips
        config:
          enforce: true
          allow:
            - 0.0.0.0/0
          deny:
            - 10.1.1.1/32
      - type: add-headers
        config:
          headers:
            x-req-yup: "true"
`;

(async function () {
  const endpoint = await ngrok.forward({
    // agent configuration
    addr: `localhost:${PORT}`,
    // authtoken: "<authtoken>",
    authtoken_from_env: true,
    onStatusChange: (status) => {
      console.log(`agent connection status: ${status}`);
    },
    session_metadata: "Online in One Line",
    // endpoint configuration
    // domain: "<domain>",
    metadata: "example endpoint metadata from nodejs",
    name: "ngrok-forward-full example",
    traffic_policy: trafficPolicy,
    // proxy_proto: "", // One of: "", "1", "2" -- PROXY protocol from the agent to your upstream.
    // upstream_protocol: "http2",
    // verify_upstream_tls: false, // set false to skip cert verification for self-signed local HTTPS backends
  });
  console.log(`Ingress established at: ${endpoint.url()}`);
})();
