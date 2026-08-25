import * as ngrok from "../index.js";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import * as fs from "fs";
import * as http from "http";
import * as http2 from "http2";
import * as retry from "./retry-config.mjs";
import * as path from "path";

axiosRetry(axios, retry.retryConfig);
const expected = "Hello";

function createHttpServer({ protocol }) {
  if (protocol === "http2") {
    return createHttp2Server();
  }

  return http.createServer(function (req, res) {
    res.writeHead(200);
    res.write(expected);
    res.end();
  });
}

function createHttp2Server() {
  const server = http2.createServer();

  server.on("stream", (stream, headers) => {
    stream.respond({
      ":status": 200,
    });
    stream.end(expected);
  });

  return server;
}

async function makeHttp(options = {}) {
  const { useHttp2 = false } = options;
  const server = createHttpServer({ protocol: useHttp2 ? "http2" : "http" });
  const socket = await server.listen(0);
  server.socket = socket;
  server.listenTo = "localhost:" + server.address().port;
  return server;
}

async function validateHttpRequest(url, axiosConfig) {
  const response = await axios.get(url, axiosConfig);
  expect(200).toBe(response.status);
  expect(expected).toBe(response.data);
  return response;
}

async function shutdown(url, socket) {
  await ngrok.disconnect(url);
  socket.close();
}

async function validateShutdown(httpServer, url, axiosConfig) {
  const response = await validateHttpRequest(url, axiosConfig);
  await shutdown(url, httpServer.socket);
  return response;
}

test("forward https", async () => {
  const httpServer = await makeHttp();
  const endpoint = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
  });
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward http2 upstream", async () => {
  const httpServer = await makeHttp({ useHttp2: true });
  const endpoint = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    // authtoken from env
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // protocol hint for the agent -> upstream connection
    upstream_protocol: "http2",
  });

  const url = endpoint.url();
  expect(url.startsWith("https://")).toBeTruthy();
  const res = await validateShutdown(httpServer, url);

  expect(res.status).toBe(200);
  expect(res.data).toContain(expected);
});

test("forward http2 upstream no cert validation", async () => {
  const httpServer = await makeHttp({ useHttp2: true });
  const endpoint = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    // authtoken from env
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // protocol hint for the agent -> upstream connection
    upstream_protocol: "http2",
    // No upstream cert validation
    verify_upstream_tls: false,
  });

  const url = endpoint.url();
  expect(url.startsWith("https://")).toBeTruthy();
  const res = await validateShutdown(httpServer, url);

  expect(res.status).toBe(200);
  expect(res.data).toContain(expected);
});

test("connect number", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.connect(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward number", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.forward(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward just string as port", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.forward(httpServer.listenTo.split(":")[1]);
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward addr port string", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.forward({ addr: httpServer.listenTo.split(":")[1] });
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward port string", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.forward({ port: httpServer.listenTo.split(":")[1] });
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward string", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const endpoint = await ngrok.forward(httpServer.listenTo);
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

// Covers what the old "forward vectorize" test exercised (basic auth, IP restriction,
// and header manipulation config fields), now expressed as a Traffic Policy document
// instead of discrete config fields. See https://ngrok.com/docs/traffic-policy/.
test("forward traffic policy: basic auth, ip restriction, headers", async () => {
  const httpServer = await makeHttp();
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
on_http_response:
  - actions:
      - type: add-headers
        config:
          headers:
            x-res-yup: "true"
`;
  const endpoint = await ngrok.forward({
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    authtoken: process.env["NGROK_AUTHTOKEN"],
    onLogEvent: (data) => {
      console.log(`data ${data}`);
    },
    onStatusChange: (status) => {
      console.log(`status ${status}`);
    },
    traffic_policy: trafficPolicy,
  });
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  const response = await validateShutdown(httpServer, url, {
    auth: { username: "ngrok", password: "online1line" },
  });
  expect("true").toBe(response.headers["x-res-yup"]);
});

test("forward tcp endpoint", async () => {
  const httpServer = await makeHttp();
  const endpoint = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tcp",
    metadata: "tcp metadata",
  });

  expect(endpoint).toBeTruthy();
  expect(endpoint.forwardsTo()).toBeTruthy();
  expect("tcp metadata").toBe(endpoint.metadata());

  await validateShutdown(httpServer, endpoint.url().replace("tcp:", "http:"));
});

// NOTE: custom TLS termination at the edge (previously configured via the `crt`/`key`
// fields) is not currently exposed by this package -- see README for details. This
// only exercises endpoint creation, not a specific certificate.
test("forward tls endpoint", async () => {
  const httpServer = await makeHttp();
  const endpoint = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tls",
    metadata: "tls metadata",
  });

  expect(endpoint.id()).toBeTruthy();
  expect(endpoint.url()).toBeTruthy();
  expect("tls metadata").toBe(endpoint.metadata());

  await ngrok.disconnect(endpoint.url());
  httpServer.socket.close();
});

// serial to not run into double error on a session issue
test("forward bad domain", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);

  await ngrok.forward({ addr: httpServer.listenTo, domain: "1.21 gigawatts" }).catch((error) => {
    expect(error.errorCode).toBe("ERR_NGROK_9034");
  });

  await shutdown(null, httpServer.socket);
});

test("traffic policy", async () => {
  const trafficPolicy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const httpServer = await makeHttp();
  const endpoint = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
    proto: "http",
    traffic_policy: trafficPolicy,
  });
  const url = endpoint.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  const response = await validateShutdown(httpServer, url);
  expect("bar").toBe(response.headers["foo"]);
});
