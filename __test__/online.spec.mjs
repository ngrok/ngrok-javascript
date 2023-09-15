// to run a single ava test case use the match flag: yarn test -m 'https tunnel'

import * as ngrok from "../index.js";
import test from "ava";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import express from "express";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as retry from "./retry-config.mjs";

axiosRetry(axios, retry.retryConfig);
const expected = "Hello";

function createExpress() {
  const app = express();
  app.get("/", (req, res) => {
    res.send(expected);
  });
  return app;
}

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

async function makeSession() {
  const builder = new ngrok.NgrokSessionBuilder();
  return await builder.authtokenFromEnv().metadata("session metadata").connect();
}

async function makeHttpAndSession(useUnixSocket) {
  return [await makeHttp(useUnixSocket), await makeSession()];
}

async function validateHttpRequest(t, url, axiosConfig) {
  const response = await axios.get(url, axiosConfig);
  t.is(200, response.status);
  t.is(expected, response.data);
  return response;
}

async function shutdown(tunnel, socket) {
  await tunnel.close();
  socket.close();
}

async function forwardValidateShutdown(t, httpServer, tunnel, url, axiosConfig) {
  tunnel.forward(httpServer.listenTo);
  const response = await validateHttpRequest(t, url, axiosConfig);
  await shutdown(tunnel, httpServer.socket);
  return response;
}

test("tls backend", async (t) => {
  ngrok.consoleLog("DEBUG");
  const session = await makeSession();
  const tunnel = await session.httpEndpoint().listenAndForward("https://dashboard.ngrok.com");

  const error = await t.throwsAsync(
    async () => {
      await axios.get(tunnel.url());
    },
    { instanceOf: AxiosError }
  );
  t.is(421, error.response.status);
  t.truthy(error.response.headers["ngrok-trace-id"]);
  await tunnel.close();
});
