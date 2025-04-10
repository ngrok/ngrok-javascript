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
  const { useUnixSocket = false, useHttp2 = false } = options;
  const server = createHttpServer({ protocol: useHttp2 ? "http2" : "http" });
  const listenTo = useUnixSocket ? "tun-" + Math.floor(Math.random() * 1000000) : 0;
  const socket = await server.listen(listenTo);
  server.socket = socket;
  server.listenTo = useUnixSocket ? listenTo : "localhost:" + server.address().port;
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
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
  });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward http2", async () => {
  const httpServer = await makeHttp({ useHttp2: true });
  const listener = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    // authtoken from env
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // The L7 app_protocol
    app_protocol: "http2",
  });

  const url = listener.url();
  expect(url.startsWith("https://")).toBeTruthy();
  const res = await validateShutdown(httpServer, url);

  expect(res.status).toBe(200);
  expect(res.data).toContain(expected);
});

test("forward http2 no cert validation", async () => {
  const httpServer = await makeHttp({ useHttp2: true });
  const listener = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    // authtoken from env
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // The L7 app_protocol
    app_protocol: "http2",
    // No upstream cert validation
    verify_upstream_tls: false,
  });

  const url = listener.url();
  expect(url.startsWith("https://")).toBeTruthy();
  const res = await validateShutdown(httpServer, url);

  expect(res.status).toBe(200);
  expect(res.data).toContain(expected);
});

test("connect number", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.connect(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward number", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward just string as port", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(httpServer.listenTo.split(":")[1]);
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward addr port string", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward({ addr: httpServer.listenTo.split(":")[1] });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward port string", async () => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward({ port: httpServer.listenTo.split(":")[1] });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward string", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(httpServer.listenTo);
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  await validateShutdown(httpServer, url);
});

test("forward vectorize", async () => {
  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // function offloading
    onLogEvent: (data) => {
      console.log(`data ${data}`);
    },
    onStatusChange: (status) => {
      console.log(`status ${status}`);
    },
    // scalar to array conversion
    basic_auth: "ngrok:online1line",
    "ip_restriction.allow_cidrs": "0.0.0.0/0",
    ip_restriction_allow_cidrs: "0.0.0.0/0",
    "ip_restriction.deny_cidrs": "10.1.1.1/32",
    ip_restriction_deny_cidrs: "10.1.1.1/32",
    "request_header.remove": "X-Req-Nope",
    request_header_remove: "X-Req-Nope2",
    "response_header.remove": "X-Res-Nope",
    response_header_remove: "X-Res-Nope2",
    "request_header.add": "X-Req-Yup:true",
    request_header_add: "X-Req-Yup2:true2",
    "response_header.add": "X-Res-Yup:true",
    response_header_add: "X-Res-Yup2:true2",
    schemes: "HTTPS",
  });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  const response = await validateShutdown(httpServer, url, {
    auth: { username: "ngrok", password: "online1line" },
  });
  expect("true").toBe(response.headers["x-res-yup"]);
  expect("true2").toBe(response.headers["x-res-yup2"]);
});

test("forward tcp listener", async () => {
  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tcp",
    forwards_to: "tcp forwards to",
    metadata: "tcp metadata",
  });

  expect(listener).toBeTruthy();

  await validateShutdown(httpServer, listener.url().replace("tcp:", "http:"), {
    auth: { username: "ngrok", password: "online1line" },
  });
});

test("forward tls listener", async () => {
  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tls",
    forwards_to: "tls forwards to",
    metadata: "tls metadata",
    crt: fs.readFileSync("examples/domain.crt", "utf8"),
    key: fs.readFileSync("examples/domain.key", "utf8"),
  });
  const url = listener.url();

  expect(url).toBeTruthy();

  const error = await expect(axios.get(url.replace("tls:", "https:"))).rejects.toThrow(AxiosError);
  expect(error.message.endsWith("signed certificate")).toBeTruthy();
  await shutdown(url, httpServer.socket);
});

// serial to not run into double error on a session issue
test("forward bad domain", async () => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const error = await expect(
    ngrok.forward({ addr: httpServer.listenTo, domain: "1.21 gigawatts" }),
  ).rejects.toThrow(Error);
  expect("ERR_NGROK_326").toBe(error.errorCode);

  await shutdown(null, httpServer.socket);
});

// serial to not run into double error on a session issue
test.skip("root_cas", async () => {
  // remove any lingering sessions
  await ngrok.disconnect();

  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);

  // tls error connecting to marketing site
  var error = await expect(
    ngrok.forward({
      addr: httpServer.listenTo,
      force_new_session: true,
      root_cas: "trusted",
      server_addr: "ngrok.com:443",
    }),
  ).rejects.toThrow(Error);
  expect(error.message.includes("tls handshake")).toBe(true);

  // non-tls error connecting to marketing site with "host" root_cas
  error = await expect(
    ngrok.forward({
      addr: httpServer.listenTo,
      force_new_session: true,
      root_cas: "host",
      server_addr: "ngrok.com:443",
    }),
  ).rejects.toThrow(Error);
  expect(error.message.includes("tls handshake")).toBe(false);
});

test("policy", async () => {
  const policy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
    proto: "http",
    policy: policy,
  });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  const response = await validateShutdown(httpServer, url);
  expect("bar").toBe(response.headers["foo"]);
});

test("traffic policy", async () => {
  const trafficPolicy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
    proto: "http",
    traffic_policy: trafficPolicy,
  });
  const url = listener.url();

  expect(url).toBeTruthy();
  expect(url.startsWith("https://")).toBeTruthy();
  const response = await validateShutdown(httpServer, url);
  expect("bar").toBe(response.headers["foo"]);
});
