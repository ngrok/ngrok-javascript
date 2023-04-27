const UNIX_SOCKET = "/tmp/http.socket";
const fs = require("fs");
try {
  fs.unlinkSync(UNIX_SOCKET);
} catch {}

// make webserver
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("Congrats you have a created an ngrok web server");
    res.end();
  })
  .listen(UNIX_SOCKET); // Server object listens on unix socket
console.log(`Node.js web server at ${UNIX_SOCKET} is running..`);

// setup ngrok
const ngrok = require("@ngrok/ngrok");
ngrok.consoleLog("INFO"); // turn on info logging

ngrok
  .connect({
    // session configuration
    addr: `pipe:${UNIX_SOCKET}`,
    // addr: `localhost:8080`,
    // authtoken: "<authtoken>",
    authtoken_from_env: true,
    on_status_change: (addr, error) => {
      console.log(`disconnected, addr ${addr} error: ${error}`);
    },
    session_metadata: "Online in One Line",
    // tunnel configuration
    basic_auth: ["ngrok:online1line"],
    circuit_breaker: 0.1,
    compression: true,
    // domain: "<domain>",
    "ip_restriction.allow_cidrs": ["0.0.0.0/0"],
    "ip_restriction.deny_cidrs": ["10.1.1.1/32"],
    metadata: "example tunnel metadata from nodejs",
    // mutual_tls_cas: [fs.readFileSync('ca.crt', 'utf8')],
    // "oauth.provider": "google",
    // "oauth.allow_domains": ["<domain>"],
    // "oauth.allow_emails": ["<email>"],
    // "oauth.scopes": ["<scope>"],
    // "oidc.issuer_url": "<url>",
    // "oidc.client_id": "<id>",
    // "oidc.client_secret": "<secret>",
    // "oidc.allow_domains": ["<domain>"],
    // "oidc.allow_emails": ["<email>"],
    // "oidc.scopes": ["<scope>"],
    proxy_proto: "", // One of: "", "1", "2"
    "request_header.remove": ["X-Req-Nope"],
    "response_header.remove": ["X-Res-Nope"],
    "request_header.add": ["X-Req-Yup:true"],
    "response_header.add": ["X-Res-Yup:true"],
    schemes: ["HTTPS"],
    // "verify_webhook.provider": "twilio",
    // "verify_webhook.secret": "asdf",
    // websocket_tcp_converter: true,
  })
  .then((url) => {
    console.log(`Ingress established at: ${url}`);
  });
