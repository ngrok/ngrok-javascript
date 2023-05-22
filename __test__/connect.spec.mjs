// to run a single ava test case use the match flag: yarn test -m 'https tunnel'

import * as ngrok from "../index.js";
import test from "ava";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import * as fs from "fs";
import * as http from "http";
import * as retry from "./retry-config.mjs";

axiosRetry(axios, retry.retryConfig);
const expected = "Hello";

function createHttpServer() {
  return http.createServer(function (req, res) {
    res.writeHead(200);
    res.write(expected);
    res.end();
  });
}

async function makeHttp(useUnixSocket) {
  const server = createHttpServer();
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

test("connect https", async (t) => {
  const httpServer = await makeHttp();
  const url = await ngrok.connect({
    addr: httpServer.listenTo,
    authtoken: process.env["NGROK_AUTHTOKEN"],
  });

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("connect number", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const url = await ngrok.connect(parseInt(httpServer.listenTo.split(":")[1], 10));

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("connect string", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const url = await ngrok.connect(httpServer.listenTo);

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
});

test("connect vectorize", async (t) => {
  const httpServer = await makeHttp();
  const url = await ngrok.connect({
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

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  const response = await validateShutdown(t, httpServer, url, {
    auth: { username: "ngrok", password: "online1line" },
  });
  t.is("true", response.headers["x-res-yup"]);
  t.is("true2", response.headers["x-res-yup2"]);
});

test("connect tcp tunnel", async (t) => {
  const httpServer = await makeHttp();
  const url = await ngrok.connect({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tcp",
    forwards_to: "tcp forwards to",
    metadata: "tcp metadata",
  });

  t.truthy(url);
  
  await validateShutdown(t, httpServer, url.replace("tcp:", "http:"));
});

test("connect tls tunnel", async (t) => {
  const httpServer = await makeHttp();
  const url = await ngrok.connect({
    addr: httpServer.listenTo,
    authtoken_from_env: true,
    proto: "tls",
    forwards_to: "tls forwards to",
    metadata: "tls metadata",
    crt: fs.readFileSync("examples/domain.crt", 'utf8'), 
    key: fs.readFileSync("examples/domain.key", 'utf8'),
  });

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