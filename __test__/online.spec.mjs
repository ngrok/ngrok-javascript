// to run a single ava test case use the match flag: yarn test -m 'https listener'

import * as ngrok from "../index.js";
import test from "ava";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import express from "express";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as retry from "./retry-config.mjs";
import * as path from "path";

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
  const builder = new ngrok.SessionBuilder();
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

async function shutdown(listener, socket) {
  await listener.close();
  socket.close();
}

async function forwardValidateShutdown(t, httpServer, listener, url, axiosConfig) {
  listener.forward(httpServer.listenTo);
  const response = await validateHttpRequest(t, url, axiosConfig);
  await shutdown(listener, httpServer.socket);
  return response;
}

test("https listener", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .httpEndpoint()
    .forwardsTo("http forwards to")
    .metadata("http metadata")
    .listen();

  t.truthy(listener.id());
  t.truthy(listener.url());
  t.truthy(listener.url().startsWith("https://"), listener.url());
  t.is("http forwards to", listener.forwardsTo());
  t.is("http metadata", listener.metadata());
  const listener_list = await session.listeners();
  t.is(1, listener_list.length);
  t.is(listener.id(), listener_list[0].id());
  t.is(listener.url(), listener_list[0].url());
  t.is(listener.id(), (await ngrok.getListenerByUrl(listener.url())).id());

  await forwardValidateShutdown(t, httpServer, listener, listener.url());
});

test("http listener", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().scheme("hTtP").listen();

  t.truthy(listener.url().startsWith("http://"), listener.url());

  await forwardValidateShutdown(t, httpServer, listener, listener.url());
});

test("unix socket", async (t) => {
  const [httpServer, session] = await makeHttpAndSession(true);
  const listener = await session.httpEndpoint().listen();
  t.truthy(httpServer.listenTo.startsWith("tun-"), httpServer.listenTo);
  listener.forward("unix:" + httpServer.listenTo);
  const response = await validateHttpRequest(t, listener.url());
  await shutdown(listener, httpServer.socket);
});

test("listen_and_serve", async (t) => {
  const httpServer = await createHttpServer();
  const session = await makeSession();
  const listener = await session.httpEndpoint().listenAndServe(httpServer);
  await validateHttpRequest(t, listener.url());
  await shutdown(listener, listener.socket);
});

test("gzip listener", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().compression().listen();

  listener.forward(httpServer.listenTo);

  const response = await axios.get(listener.url(), { decompress: false });
  t.is("gzip", response.headers["content-encoding"]);
  await shutdown(listener, httpServer.socket);
});

test("tls backend", async (t) => {
  const session = await makeSession();
  const listener = await session.httpEndpoint().listenAndForward("https://dashboard.ngrok.com");

  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url());
    },
    { instanceOf: AxiosError }
  );
  t.is(421, error.response.status);
  t.truthy(error.response.data.includes("different Host"));
  await listener.close();
});

test("unverified tls backend", async (t) => {
  const session = await makeSession();
  const listener = await session
    .httpEndpoint()
    .verifyUpstreamTls(false)
    .listenAndForward("https://dashboard.ngrok.com");

  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url());
    },
    { instanceOf: AxiosError }
  );
  t.is(421, error.response.status);
  t.truthy(error.response.data.includes("different Host"));
  await listener.close();
});

test("http headers", async (t) => {
  const httpServer = http.createServer(function (req, res) {
    const { headers } = req;
    t.is("bar", headers["foo"]);
    t.is(undefined, headers["baz"]);
    res.writeHead(200, { python: "sss" });
    res.write(expected);
    res.end();
  });
  const socket = await httpServer.listen(0);
  httpServer.socket = socket;
  httpServer.listenTo = "localhost:" + httpServer.address().port;

  const session = await makeSession();
  const listener = await session
    .httpEndpoint()
    .requestHeader("foo", "bar")
    .removeRequestHeader("baz")
    .responseHeader("spam", "eggs")
    .removeResponseHeader("python")
    .listen();

  const response = await forwardValidateShutdown(t, httpServer, listener, listener.url(), {
    headers: { baz: "req" },
  });
  t.is("eggs", response.headers["spam"]);
  t.is(undefined, response.headers["python"]);
});

test("basic auth", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().basicAuth("ngrok", "online1line").listen();

  listener.forward(httpServer.listenTo);

  const response = await forwardValidateShutdown(t, httpServer, listener, listener.url(), {
    auth: { username: "ngrok", password: "online1line" },
  });
});

test("oauth", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().oauth("google").listen();

  listener.forward(httpServer.listenTo);

  const response = await axios.get(listener.url());
  t.not(expected, response.data);
  t.truthy(response.data.includes("accounts.google.com"));
  await shutdown(listener, httpServer.socket);
});

test("custom domain", async (t) => {
  const domain = "d" + Math.floor(Math.random() * 1000000) + ".ngrok.io";
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().domain(domain).listen();

  t.is("https://" + domain, listener.url());

  await forwardValidateShutdown(t, httpServer, listener, listener.url());
});

test("proxy proto", async (t) => {
  const tcpServer = net.createServer(function (c) {
    c.on("readable", function () {
      var chunk,
        N = 10;
      while (null !== (chunk = c.read(N))) {
        const utf8Encode = new TextEncoder();
        const bytes = utf8Encode.encode("PROXY TCP4");
        t.deepEqual(Buffer.from(bytes), chunk);
        break;
      }
    });
  });
  const socket = await tcpServer.listen(0);

  const session = await makeSession();
  const listener = await session.httpEndpoint().proxyProto("1").listen();

  listener.forward("localhost:" + socket.address().port);

  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url(), { timeout: 1000 });
    },
    { instanceOf: AxiosError }
  );
  await shutdown(listener, socket);
});

test("ip restriction http", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(t, httpServer, session.httpEndpoint());
  t.is(403, error.response.status);
});

test("ip restriction tcp", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(t, httpServer, session.tcpEndpoint());
  // ECONNRESET or ECONNREFUSED
  t.truthy(error.code.startsWith("ECONNRE"), error.code);
});

async function ipRestriction(t, httpServer, listenerBuilder) {
  const listener = await listenerBuilder.allowCidr("127.0.0.1/32").denyCidr("0.0.0.0/0").listen();

  listener.forward(httpServer.listenTo);
  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url().replace("tcp:", "http:"));
    },
    { instanceOf: AxiosError }
  );
  await shutdown(listener, httpServer.socket);
  return error;
}

test("websocket conversion", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().websocketTcpConversion().listen();

  listener.forward(httpServer.listenTo);

  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url());
    },
    { instanceOf: AxiosError }
  );
  // ERR_NGROK_3206: Expected a websocket request with a "Connection: upgrade" header
  // but did not receive one.
  t.is("ERR_NGROK_3206", error.response.headers["ngrok-error-code"]);
  await shutdown(listener, httpServer.socket);
});

test("useragent", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .httpEndpoint()
    .allowUserAgent("^mozilla.*")
    .denyUserAgent(".*")
    .listen();

  listener.forward(httpServer.listenTo);

  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url());
    },
    { instanceOf: AxiosError }
  );
  // ERR_NGROK_3211: The server does not authorize requests from your user-agent.
  t.is("ERR_NGROK_3211", error.response.headers["ngrok-error-code"]);
  await shutdown(listener, httpServer.socket);
});

test("tcp listener", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .tcpEndpoint()
    .forwardsTo("tcp forwards to")
    .metadata("tcp metadata")
    .listen();

  t.truthy(listener.id());
  t.truthy(listener.url());
  t.is("tcp forwards to", listener.forwardsTo());
  t.is("tcp metadata", listener.metadata());

  await forwardValidateShutdown(t, httpServer, listener, listener.url().replace("tcp:", "http:"));
});

test("tls listener", async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .tlsEndpoint()
    .forwardsTo("tls forwards to")
    .metadata("tls metadata")
    .termination(fs.readFileSync("examples/domain.crt"), fs.readFileSync("examples/domain.key"))
    .listen();

  t.truthy(listener.id());
  t.truthy(listener.url());
  t.is("tls forwards to", listener.forwardsTo());
  t.is("tls metadata", listener.metadata());

  listener.forward(httpServer.listenTo);
  const error = await t.throwsAsync(
    async () => {
      await axios.get(listener.url().replace("tls:", "https:"));
    },
    { instanceOf: AxiosError }
  );
  t.truthy(error.message.endsWith("signed certificate"), error.message);
  await shutdown(listener, httpServer.socket);
});

test("smoke", async (t) => {
  const httpServer = await createHttpServer();
  const socket = await ngrok.listen(httpServer);
  const response = await axios.get(socket.listener.url());
  t.is(200, response.status);
  await shutdown(socket.listener, socket);
});

test("net listen", async (t) => {
  const httpServer = await createHttpServer();
  const socket = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(t, socket.listener.url());
  await shutdown(socket.listener, socket);
});

test("net listenable", async (t) => {
  const httpServer = await createHttpServer();
  const listener = await ngrok.listenable();
  httpServer.listen(listener);
  const response = await validateHttpRequest(t, listener.url());
  await shutdown(listener, listener.handle);
});

test("express listen", async (t) => {
  const httpServer = await createExpress();
  const socket = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(t, socket.listener.url());
  await shutdown(socket.listener, socket);
});

test("express listenable", async (t) => {
  const httpServer = await createExpress();
  const listener = await ngrok.listenable();
  httpServer.listen(listener);
  const response = await validateHttpRequest(t, listener.url());
  await shutdown(listener, listener.handle);
});

test("no bind", async (t) => {
  const httpServer = await createHttpServer();
  const session = await makeSession();
  const listener = await session.httpEndpoint().listen(false);
  t.is(undefined, listener.handle);
});

// run serially so other tests are not logging
test.serial("console log", async (t) => {
  // register logging callback
  ngrok.consoleLog();
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().listen();
  await forwardValidateShutdown(t, httpServer, listener, listener.url());
  // unregister the callback
  ngrok.loggingCallback();
});

test("listen and forward multipass", async (t) => {
  const [httpServer, session1] = await makeHttpAndSession();
  const session2 = await makeSession();
  const url = "tcp://" + httpServer.listenTo;
  const listener1 = await session1.httpEndpoint().listenAndForward(url);
  const listener2 = await session1.httpEndpoint().listenAndForward(url);
  const listener3 = await session2.httpEndpoint().listenAndForward(url);
  const listener4 = await session2.tcpEndpoint().listenAndForward(url);

  t.is(2, (await session1.listeners()).length);
  t.is(2, (await session2.listeners()).length);
  t.truthy((await ngrok.listeners()).length >= 4);
  t.is(listener3.url(), (await ngrok.getListener(listener3.id())).url());

  await validateHttpRequest(t, listener1.url());
  await validateHttpRequest(t, listener2.url());
  await validateHttpRequest(t, listener3.url());
  await validateHttpRequest(t, listener4.url().replace("tcp:", "http:"));
  await shutdown(listener1, httpServer.socket);
  await listener2.close();
  await session2.close();
});

test("tcp multipass", async (t) => {
  const [httpServer, session1] = await makeHttpAndSession();
  const session2 = await makeSession();
  const listener1 = await session1.httpEndpoint().listen();
  const listener2 = await session1.httpEndpoint().listen();
  const listener3 = await session2.httpEndpoint().listen();
  const listener4 = await session2.tcpEndpoint().listen();

  listener1.forward(httpServer.listenTo);
  listener2.forward(httpServer.listenTo);
  listener3.forward(httpServer.listenTo);
  listener4.forward(httpServer.listenTo);

  t.is(2, (await session1.listeners()).length);
  t.is(2, (await session2.listeners()).length);
  t.truthy((await ngrok.listeners()).length >= 4);
  t.is(listener3.url(), (await ngrok.getListener(listener3.id())).url());

  await validateHttpRequest(t, listener1.url());
  await validateHttpRequest(t, listener2.url());
  await validateHttpRequest(t, listener3.url());
  await validateHttpRequest(t, listener4.url().replace("tcp:", "http:"));
  await shutdown(listener1, httpServer.socket);
  await listener2.close();
  await session2.close();
});

test("unix multipass", async (t) => {
  const httpServer = createHttpServer();
  const session1 = await makeSession();
  const session2 = await makeSession();
  const listener1 = await session1.httpEndpoint().listen();
  const listener2 = await session1.httpEndpoint().listen();
  const listener3 = await session2.httpEndpoint().listen();
  const listener4 = await session2.tcpEndpoint().listen();
  const socket = await ngrok.listen(httpServer, listener1);

  listener2.forward("unix:" + socket.path);
  listener3.forward("unix:" + socket.path);
  listener4.forward("unix:" + socket.path);

  await validateHttpRequest(t, listener1.url());
  await validateHttpRequest(t, listener2.url());
  await validateHttpRequest(t, listener3.url());
  await validateHttpRequest(t, listener4.url().replace("tcp:", "http:"));
  await shutdown(listener1, socket);
  await listener2.close();
  await listener3.close();
  await listener4.close();
});

test("connect heartbeat callbacks", async (t) => {
  var conn_addr, disconn_addr, test_latency;
  const builder = new ngrok.SessionBuilder();
  builder
    .clientInfo("connect_heartbeat_callbacks", "1.2.3")
    .handleHeartbeat((latency) => {
      test_latency = latency;
    })
    .handleDisconnection((addr, err) => {
      disconn_addr = addr;
    });
  await builder.connect();
  t.truthy(test_latency > 0, String(test_latency));
  t.is(undefined, disconn_addr, String(disconn_addr));
});

test("session ca_cert", async (t) => {
  const builder = new ngrok.SessionBuilder();
  const error = await t.throwsAsync(
    async () => {
      await builder.authtokenFromEnv().caCert(fs.readFileSync("examples/domain.crt")).connect();
    },
    { instanceOf: Error }
  );
  t.truthy(error.message.includes("tls"), error.message);
});

test("session incorrect authtoken", async (t) => {
  const builder = new ngrok.SessionBuilder();
  const error = await t.throwsAsync(
    async () => {
      await builder.authtoken("badtoken").connect();
    },
    { instanceOf: Error }
  );
  t.is("ERR_NGROK_105", error.errorCode);
});

test("listener invalid domain", async (t) => {
  const session = await makeSession();
  const error = await t.throwsAsync(
    async () => {
      await session.httpEndpoint().domain("1.21 gigawatts").listen();
    },
    { instanceOf: Error }
  );
  t.is("ERR_NGROK_326", error.errorCode);
});

test("policy", async (t) => {
  const policy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().policy(policy).listen();
  const response = await forwardValidateShutdown(t, httpServer, listener, listener.url());
  t.is("bar", response.headers["foo"]);
});

test("traffic policy", async (t) => {
  const trafficPolicy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().trafficPolicy(trafficPolicy).listen();
  const response = await forwardValidateShutdown(t, httpServer, listener, listener.url());
  t.is("bar", response.headers["foo"]);
});
