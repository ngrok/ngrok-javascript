// to run a single ava test case use the match flag: yarn test -m 'https listener'

import * as ngrok from "../index.js";
import test from "ava";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import * as fs from "fs";
import * as http from "http";
import * as http2 from "http2";
import * as retry from "./retry-config.mjs";
import * as path from "path";
import exp from "constants";

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

async function validateHttpRequest(t, url, axiosConfig) {
  const response = await axios.get(url, axiosConfig);
  t.is(200, response.status);
  t.is(expected, response.data);
  return response;
}

async function shutdown(url, socket) {
  await ngrok.disconnect(url);
  socket.close();
}

async function validateShutdown(t, httpServer, url, axiosConfig) {
  const response = await validateHttpRequest(t, url, axiosConfig);
  await shutdown(url, httpServer.socket);
  return response;
}

test("forward https", async (t) => {
  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
  });
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward http2", async (t) => {
  const httpServer = await makeHttp({useHttp2: true});
  const listener = await ngrok.forward({
    // numeric port
    addr: parseInt(httpServer.listenTo.split(":")[1], 10),
    // authtoken from env
    authtoken: process.env["NGROK_AUTHTOKEN"],
    // The L7 app_protocol
    app_protocol: "http2",
  });

  const url = listener.url();
  t.truthy(url.startsWith("https://"), url);
  const res = await validateShutdown(t, httpServer, url);

  t.assert(res.status === 200);
  t.assert(res.data.includes(expected));
});

test("forward http2 no cert validation", async (t) => {
  const httpServer = await makeHttp({useHttp2: true});
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
  t.truthy(url.startsWith("https://"), url);
  const res = await validateShutdown(t, httpServer, url);

  t.assert(res.status === 200);
  t.assert(res.data.includes(expected));
});

test("connect number", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.connect(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward number", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(parseInt(httpServer.listenTo.split(":")[1], 10));
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward port string", async (t) => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(httpServer.listenTo.split(":")[1]);
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward addr port string", async (t) => {
  ngrok.consoleLog();
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward({ addr: httpServer.listenTo.split(":")[1] });
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward string", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const listener = await ngrok.forward(httpServer.listenTo);
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("forward vectorize", async (t) => {
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

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  const response = await validateShutdown(t, httpServer, url, {
    auth: { username: "ngrok", password: "online1line" },
  });
  t.is("true", response.headers["x-res-yup"]);
  t.is("true2", response.headers["x-res-yup2"]);
});

test("forward tcp listener", async (t) => {
  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tcp",
    forwards_to: "tcp forwards to",
    metadata: "tcp metadata",
  });

  t.truthy(listener);

  await validateShutdown(t, httpServer, listener.url().replace("tcp:", "http:"));
});

test("forward tls listener", async (t) => {
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

  t.truthy(url);

  const error = await t.throwsAsync(
    async () => {
      await axios.get(url.replace("tls:", "https:"));
    },
    { instanceOf: AxiosError }
  );
  t.truthy(error.message.endsWith("signed certificate"), error.message);
  await shutdown(url, httpServer.socket);
});

// serial to not run into double error on a session issue
test.serial("forward bad domain", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const error = await t.throwsAsync(
    async () => {
      await ngrok.forward({ addr: httpServer.listenTo, domain: "1.21 gigawatts" });
    },
    { instanceOf: Error }
  );
  t.is("ERR_NGROK_326", error.errorCode, error.message);
});

test("policy", async (t) => {
  const policy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const httpServer = await makeHttp();
  const listener = await ngrok.forward({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
    proto: "http",
    policy: policy,
  });
  const url = listener.url();

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  const response = await validateShutdown(t, httpServer, url);
  t.is("bar", response.headers["foo"]);
});
