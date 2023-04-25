// to run a single ava test case use the match flag: yarn test -m 'https tunnel'

import * as ngrok from "../index.js";
import test from "ava";
import axios, { AxiosError } from "axios";
import * as http from "http";

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
  const url = await ngrok.connect(
    parseInt(httpServer.listenTo.split(":")[1], 10)
  );

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
  ngrok.authtoken("");
});

test("connect string", async (t) => {
  const httpServer = await makeHttp();
  ngrok.authtoken(process.env["NGROK_AUTHTOKEN"]);
  const url = await ngrok.connect(httpServer.listenTo);

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url);
  ngrok.authtoken("");
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
    "ip_restriction.deny_cidrs": "10.1.1.1/32",
    "request_header.remove": "X-Req-Nope",
    "response_header.remove": "X-Res-Nope",
    "request_header.add": "X-Req-Yup:true",
    "response_header.add": "X-Res-Yup:true",
    schemes: "HTTPS",
  });

  t.truthy(url);
  t.truthy(url.startsWith("https://"), url);
  await validateShutdown(t, httpServer, url, {auth: { username: "ngrok", password: "online1line" }} );
});
