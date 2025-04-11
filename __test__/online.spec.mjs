import * as ngrok from "../index.js";
import axios, { AxiosError } from "axios";
import axiosRetry from "axios-retry";
import express from "express";
import * as fs from "fs";
import * as http from "http";
import * as net from "net";
import * as retry from "./retry-config.mjs";
import * as path from "path";
import * as os from "os";

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
  const socket = server.listen(listenTo);
  server.socket = socket;
  server.listenTo = useUnixSocket ? listenTo : "localhost:" + server.address().port;
  return server;
}

async function makeSession() {
  const builder = new ngrok.SessionBuilder();
  return await builder
    .authtoken(process.env["NGROK_AUTHTOKEN"])
    .metadata("session metadata")
    .connect();
}

async function makeHttpAndSession(useUnixSocket) {
  return [await makeHttp(useUnixSocket), await makeSession()];
}

async function validateHttpRequest(url, axiosConfig) {
  const response = await axios.get(url, axiosConfig);
  expect(200).toBe(response.status);
  expect(expected).toBe(response.data);
  return response;
}

async function shutdown(listener, socket) {
  try {
    if (listener) {
      await listener.close();
    }
    if (socket) {
      socket.close();
    }
  } catch (error) {
    console.error("Error during shutdown:", error);
    // Don't rethrow - we want to ensure cleanup continues
  }
}

async function forwardValidateShutdown(httpServer, listener, url, axiosConfig) {
  listener.forward(httpServer.listenTo);
  const response = await validateHttpRequest(url, axiosConfig);
  await shutdown(listener, httpServer.socket);
  return response;
}

test("https listener", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .httpEndpoint()
    .forwardsTo("http forwards to")
    .metadata("http metadata")
    .listen();

  expect(listener.id()).toBeTruthy();
  expect(listener.url()).toBeTruthy();
  expect(listener.url().startsWith("https://")).toBeTruthy();
  expect("http forwards to").toBe(listener.forwardsTo());
  expect("http metadata").toBe(listener.metadata());
  const listener_list = await session.listeners();
  expect(1).toBe(listener_list.length);
  expect(listener.id()).toBe(listener_list[0].id());
  expect(listener.url()).toBe(listener_list[0].url());
  expect(listener.id()).toBe((await ngrok.getListenerByUrl(listener.url())).id());

  await forwardValidateShutdown(httpServer, listener, listener.url());
});

test("http listener", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().scheme("hTtP").listen();

  expect(listener.url().startsWith("http://")).toBeTruthy();

  await forwardValidateShutdown(httpServer, listener, listener.url());
});

test("unix socket", async () => {
  const [httpServer, session] = await makeHttpAndSession(true);
  const listener = await session.httpEndpoint().listen();
  expect(httpServer.listenTo.startsWith("tun-")).toBeTruthy();
  listener.forward("unix:" + httpServer.listenTo);
  const response = await validateHttpRequest(listener.url());
  await shutdown(listener, httpServer.socket);
});

test("listen_and_serve", async () => {
  const httpServer = await createHttpServer();
  const session = await makeSession();
  const listener = await session.httpEndpoint().listenAndServe(httpServer);
  await validateHttpRequest(listener.url());
  await shutdown(listener, listener.socket);
});

test("gzip listener", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().compression().listen();

  listener.forward(httpServer.listenTo);

  const response = await axios.get(listener.url(), { decompress: false });
  expect("gzip").toBe(response.headers["content-encoding"]);
  await shutdown(listener, httpServer.socket);
});

test("tls backend", async () => {
  const session = await makeSession();
  const listener = await session.httpEndpoint().listenAndForward("https://dashboard.ngrok.com");

  await expect(async () => {
    await axios.get(listener.url());
  }).rejects.toThrow(AxiosError);

  const error = await axios.get(listener.url()).catch((e) => e);
  expect(error.response.status).toBe(421);
  expect(error.response.data.includes("different Host")).toBeTruthy();
  await listener.close();
});

test("unverified tls backend", async () => {
  const session = await makeSession();
  const listener = await session
    .httpEndpoint()
    .verifyUpstreamTls(false)
    .listenAndForward("https://dashboard.ngrok.com");

  try {
    await axios.get(listener.url());
  } catch (error) {
    expect(error).toBeInstanceOf(AxiosError);
    expect(error.response.status).toBe(421);
    expect(error.response.data.includes("different Host")).toBeTruthy();
  }
  await listener.close();
});

test("http headers", async () => {
  const httpServer = http.createServer(function (req, res) {
    const { headers } = req;
    expect("bar").toBe(headers["foo"]);
    expect(undefined).toBe(headers["baz"]);
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

  const response = await forwardValidateShutdown(httpServer, listener, listener.url(), {
    headers: { baz: "req" },
  });
  expect("eggs").toBe(response.headers["spam"]);
  expect(undefined).toBe(response.headers["python"]);
});

test("basic auth", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().basicAuth("ngrok", "online1line").listen();

  listener.forward(httpServer.listenTo);

  const response = await forwardValidateShutdown(httpServer, listener, listener.url(), {
    auth: { username: "ngrok", password: "online1line" },
  });
});

test("oauth", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().oauth("google").listen();

  listener.forward(httpServer.listenTo);

  const response = await axios.get(listener.url());
  expect(expected).not.toBe(response.data);
  expect(response.data.includes("accounts.google.com")).toBeTruthy();
  await shutdown(listener, httpServer.socket);
});

test("custom domain", async () => {
  const domain = "d" + Math.floor(Math.random() * 1000000) + ".ngrok.io";
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().domain(domain).listen();

  expect("https://" + domain).toBe(listener.url());

  await forwardValidateShutdown(httpServer, listener, listener.url());
});

test("proxy proto", async () => {
  const hasIPv6 = Object.values(os.networkInterfaces())
    .flat()
    .some((iface) => iface.family === "IPv6" && !iface.internal);

  const tcpServer = net.createServer(function (c) {
    c.on("readable", function () {
      let chunk,
        N = 10;
      while (null !== (chunk = c.read(N))) {
        const bytes = Buffer.from(`PROXY TCP${hasIPv6 ? "6" : "4"}`);
        //t.deepEqual(bytes, chunk);
      }
    });
  });
  const socket = tcpServer.listen(0);

  const session = await makeSession();
  const listener = await session.httpEndpoint().proxyProto("1").listen();

  listener.forward("localhost:" + socket.address().port);

  await axios.get(listener.url(), { timeout: 1000 }).catch((err) => {
    expect(err).toBeInstanceOf(AxiosError);
  });

  await shutdown(listener, socket);
});

test("ip restriction http", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(httpServer, session.httpEndpoint());
  expect(403).toBe(error.response.status);
});

test("ip restriction tcp", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(httpServer, session.tcpEndpoint());
  // ECONNRESET or ECONNREFUSED
  expect(error.code.startsWith("ECONNRE")).toBeTruthy();
});

async function ipRestriction(httpServer, listenerBuilder) {
  const listener = await listenerBuilder.allowCidr("127.0.0.1/32").denyCidr("0.0.0.0/0").listen();

  listener.forward(httpServer.listenTo);
  return await axios.get(listener.url().replace("tcp:", "http:")).catch(async (err) => {
    expect(err).toBeInstanceOf(AxiosError);
    await shutdown(listener, httpServer.socket);
    return err;
  });
}

test("websocket conversion", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().websocketTcpConversion().listen();

  listener.forward(httpServer.listenTo);

  try {
    await axios.get(listener.url());
  } catch (error) {
    expect(error).toBeInstanceOf(AxiosError);
    // ERR_NGROK_3206: Expected a websocket request with a "Connection: upgrade" header
    // but did not receive one.
    expect(error.response.headers["ngrok-error-code"]).toBe("ERR_NGROK_3206");
  }
  await shutdown(listener, httpServer.socket);
});

test("useragent", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .httpEndpoint()
    .allowUserAgent("^mozilla.*")
    .denyUserAgent(".*")
    .listen();

  listener.forward(httpServer.listenTo);

  try {
    await axios.get(listener.url());
  } catch (error) {
    expect(error).toBeInstanceOf(AxiosError);
    // ERR_NGROK_3211: The server does not authorize requests from your user-agent.
    expect(error.response.headers["ngrok-error-code"]).toBe("ERR_NGROK_3211");
  }
  await shutdown(listener, httpServer.socket);
});

test("tcp listener", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .tcpEndpoint()
    .forwardsTo("tcp forwards to")
    .metadata("tcp metadata")
    .listen();

  expect(listener.id()).toBeTruthy();
  expect(listener.url()).toBeTruthy();
  expect("tcp forwards to").toBe(listener.forwardsTo());
  expect("tcp metadata").toBe(listener.metadata());

  await forwardValidateShutdown(httpServer, listener, listener.url().replace("tcp:", "http:"));
});

test("tls listener", async () => {
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session
    .tlsEndpoint()
    .forwardsTo("tls forwards to")
    .metadata("tls metadata")
    .termination(fs.readFileSync("examples/domain.crt"), fs.readFileSync("examples/domain.key"))
    .listen();

  expect(listener.id()).toBeTruthy();
  expect(listener.url()).toBeTruthy();
  expect("tls forwards to").toBe(listener.forwardsTo());
  expect("tls metadata").toBe(listener.metadata());

  listener.forward(httpServer.listenTo);
  try {
    await axios.get(listener.url().replace("tls:", "https:"));
  } catch (error) {
    expect(error).toBeInstanceOf(AxiosError);
    expect(error.message.endsWith("signed certificate")).toBeTruthy();
  }
  await shutdown(listener, httpServer.socket);
});

test("smoke", async () => {
  const httpServer = await createHttpServer();
  const socket = await ngrok.listen(httpServer);
  const response = await axios.get(socket.listener.url());
  expect(200).toBe(response.status);
  await shutdown(socket.listener, socket);
});

test("net listen", async () => {
  const httpServer = await createHttpServer();
  const socket = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(socket.listener.url());
  await shutdown(socket.listener, socket);
});

test("net listenable", async () => {
  const httpServer = await createHttpServer();
  const listener = await ngrok.listenable();
  httpServer.listen(listener);
  const response = await validateHttpRequest(listener.url());
  await shutdown(listener, listener.handle);
});

test("express listen", async () => {
  const httpServer = await createExpress();
  const socket = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(socket.listener.url());
  await shutdown(socket.listener, socket);
});

test("express listenable", async () => {
  const httpServer = await createExpress();
  const listener = await ngrok.listenable();
  httpServer.listen(listener);
  const response = await validateHttpRequest(listener.url());
  await shutdown(listener, listener.handle);
});

test("no bind", async () => {
  const httpServer = await createHttpServer();
  const session = await makeSession();
  const listener = await session.httpEndpoint().listen(false);
  expect(undefined).toBe(listener.handle);
});

// run serially so other tests are not logging
test("console log", async () => {
  // register logging callback
  ngrok.consoleLog();
  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().listen();
  await forwardValidateShutdown(httpServer, listener, listener.url());
  // unregister the callback
  ngrok.loggingCallback();
});

test("listen and forward multipass", async () => {
  const [httpServer, session1] = await makeHttpAndSession();
  const session2 = await makeSession();
  const url = "tcp://" + httpServer.listenTo;
  const listener1 = await session1.httpEndpoint().listenAndForward(url);
  const listener2 = await session1.httpEndpoint().listenAndForward(url);
  const listener3 = await session2.httpEndpoint().listenAndForward(url);
  const listener4 = await session2.tcpEndpoint().listenAndForward(url);

  expect(2).toBe((await session1.listeners()).length);
  expect(2).toBe((await session2.listeners()).length);
  expect((await ngrok.listeners()).length >= 4).toBeTruthy();
  expect(listener3.url()).toBe((await ngrok.getListener(listener3.id())).url());

  await validateHttpRequest(listener1.url());
  await validateHttpRequest(listener2.url());
  await validateHttpRequest(listener3.url());
  await validateHttpRequest(listener4.url().replace("tcp:", "http:"));

  await shutdown(listener1, httpServer.socket);
  await listener2.close();
  await session2.close();
});

test("tcp multipass", async () => {
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

  expect(2).toBe((await session1.listeners()).length);
  expect(2).toBe((await session2.listeners()).length);
  expect((await ngrok.listeners()).length >= 4).toBeTruthy();
  expect(listener3.url()).toBe((await ngrok.getListener(listener3.id())).url());

  await validateHttpRequest(listener1.url());
  await validateHttpRequest(listener2.url());
  await validateHttpRequest(listener3.url());
  await validateHttpRequest(listener4.url().replace("tcp:", "http:"));
  await shutdown(listener1, httpServer.socket);
  await listener2.close();
  await session2.close();
});

// test("unix multipass", async () => {
//   const httpServer = createHttpServer();
//   const session1 = await makeSession();
//   const session2 = await makeSession();
//   const listener1 = await session1.httpEndpoint().listen();
//   const listener2 = await session1.httpEndpoint().listen();
//   const listener3 = await session2.httpEndpoint().listen();
//   const listener4 = await session2.tcpEndpoint().listen();
//   const socket = ngrok.listen(httpServer, listener1);

//   listener2.forward("unix:" + socket.path);
//   listener3.forward("unix:" + socket.path);
//   listener4.forward("unix:" + socket.path);

//   await validateHttpRequest(listener1.url());
//   await validateHttpRequest(listener2.url());
//   await validateHttpRequest(listener3.url());
//   await validateHttpRequest(listener4.url().replace("tcp:", "http:"));
//   await shutdown(listener1, socket);
//   await listener2.close();
//   await listener3.close();
//   await listener4.close();
// });

test("connect heartbeat callbacks", async () => {
  var conn_addr, disconn_addr, test_latency;
  const builder = new ngrok.SessionBuilder().authtoken(process.env["NGROK_AUTHTOKEN"]);
  builder
    .clientInfo("connect_heartbeat_callbacks", "1.2.3")
    .handleHeartbeat((latency) => {
      test_latency = latency;
    })
    .handleDisconnection((addr, err) => {
      disconn_addr = addr;
    });
  await builder.connect();
  expect(test_latency > 0).toBeTruthy();
  expect(undefined).toBe(disconn_addr);
});

test("session ca_cert", async () => {
  const builder = new ngrok.SessionBuilder();
  try {
    await builder.authtokenFromEnv().caCert(fs.readFileSync("examples/domain.crt")).connect();
  } catch (error) {
    expect(error.message.includes("tls")).toBeTruthy();
  }
});

test("session incorrect authtoken", async () => {
  const builder = new ngrok.SessionBuilder();
  try {
    await builder.authtoken("badtoken").connect();
  } catch (error) {
    expect(error.errorCode).toBe("ERR_NGROK_105");
  }
});

test("listener invalid domain", async () => {
  const session = await makeSession();
  try {
    await session.httpEndpoint().domain("1.21 gigawatts").listen();
  } catch (error) {
    expect(error.errorCode).toBe("ERR_NGROK_326");
  }
});

test("policy", async () => {
  const policy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().policy(policy).listen();
  const response = await forwardValidateShutdown(httpServer, listener, listener.url());
  expect("bar").toBe(response.headers["foo"]);
});

test("traffic policy", async () => {
  const trafficPolicy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const [httpServer, session] = await makeHttpAndSession();
  const listener = await session.httpEndpoint().trafficPolicy(trafficPolicy).listen();
  const response = await forwardValidateShutdown(httpServer, listener, listener.url());
  expect("bar").toBe(response.headers["foo"]);
});
