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

(async function () {
  const listener = await ngrok.connect({
    // session configuration
    addr: `unix:${UNIX_SOCKET}`,
    // addr: `localhost:8080`,
    // authtoken: "<authtoken>",
    authtoken_from_env: true,
    on_status_change: (addr, error) => {
      console.log(`disconnected, addr ${addr} error: ${error}`);
    },
    session_metadata: "Online in One Line",
    // listener configuration
    // allow_user_agent: "^mozilla.*",
    basic_auth: ["ngrok:online1line"],
    circuit_breaker: 0.1,
    compression: true,
    // deny_user_agent: "^curl.*",
    // domain: "<domain>",
    ip_restriction_allow_cidrs: ["0.0.0.0/0"],
    ip_restriction_deny_cidrs: ["10.1.1.1/32"],
    metadata: "example listener metadata from nodejs",
    // mutual_tls_cas: [fs.readFileSync('ca.crt', 'utf8')],
    // oauth_provider: "google",
    // oauth_allow_domains: ["<domain>"],
    // oauth_allow_emails: ["<email>"],
    // oauth_scopes: ["<scope>"],
    // oauth_client_id: "<id>",
    // oauth_client_secret: "<secret>",
    // oidc_issuer_url: "<url>",
    // oidc_client_id: "<id>",
    // oidc_client_secret: "<secret>",
    // oidc_allow_domains: ["<domain>"],
    // oidc_allow_emails: ["<email>"],
    // oidc_scopes": ["<scope>"],
    proxy_proto: "", // One of: "", "1", "2"
    request_header_remove: ["X-Req-Nope"],
    response_header_remove: ["X-Res-Nope"],
    request_header_add: ["X-Req-Yup:true"],
    response_header_add: ["X-Res-Yup:true"],
    schemes: ["HTTPS"],
    // verify_webhook_provider: "twilio",
    // verify_webhook_secret: "asdf",
    // websocket_tcp_converter: true,
  });
  console.log(`Ingress established at: ${listener.url()}`);
})();
