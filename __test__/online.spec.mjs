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

async function makeHttp() {
  const server = createHttpServer();
  const socket = server.listen(0);
  server.socket = socket;
  server.listenTo = "localhost:" + server.address().port;
  return server;
}

async function makeAgent() {
  const builder = new ngrok.AgentBuilder();
  return await builder
    .authtoken(process.env["NGROK_AUTHTOKEN"])
    .metadata("agent metadata")
    .connect();
}

async function makeHttpAndAgent() {
  return [await makeHttp(), await makeAgent()];
}

async function validateHttpRequest(url, axiosConfig) {
  const response = await axios.get(url, axiosConfig);
  expect(200).toBe(response.status);
  expect(expected).toBe(response.data);
  return response;
}

async function shutdown(endpoint, socket) {
  try {
    if (endpoint) {
      await endpoint.close();
    }
    if (socket) {
      socket.close();
    }
  } catch (error) {
    console.error("Error during shutdown:", error);
    // Don't rethrow - we want to ensure cleanup continues
  }
}

async function validateAndShutdown(httpServer, endpoint, url, axiosConfig) {
  const response = await validateHttpRequest(url, axiosConfig);
  await shutdown(endpoint, httpServer.socket);
  return response;
}

test("http endpoint", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent
    .httpEndpoint()
    .metadata("http metadata")
    .forward(httpServer.listenTo);

  expect(endpoint.id()).toBeTruthy();
  expect(endpoint.url()).toBeTruthy();
  expect(endpoint.url().startsWith("https://")).toBeTruthy();
  expect(endpoint.forwardsTo()).toBeTruthy();
  expect("http metadata").toBe(endpoint.metadata());
  const endpointList = await agent.endpoints();
  expect(1).toBe(endpointList.length);
  expect(endpoint.id()).toBe(endpointList[0].id());
  expect(endpoint.url()).toBe(endpointList[0].url());
  expect(endpoint.id()).toBe((await ngrok.getEndpointByUrl(endpoint.url())).id());

  await validateAndShutdown(httpServer, endpoint, endpoint.url());
});

test("serve", async () => {
  const httpServer = await createHttpServer();
  const agent = await makeAgent();
  const endpoint = await agent.httpEndpoint().serve(httpServer);
  await validateHttpRequest(endpoint.url());
  await shutdown(endpoint, endpoint.socket);
});

// Covers what the old "gzip listener" test exercised (the `compression()` builder
// method), now expressed as a Traffic Policy document. See
// https://ngrok.com/docs/traffic-policy/actions/compress-response/.
test("traffic policy: compress response", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const trafficPolicy = `
on_http_response:
  - actions:
      - type: compress-response
        config:
          algorithms:
            - gzip
`;
  const endpoint = await agent
    .httpEndpoint()
    .trafficPolicy(trafficPolicy)
    .forward(httpServer.listenTo);

  const response = await axios.get(endpoint.url(), { decompress: false });
  expect("gzip").toBe(response.headers["content-encoding"]);
  await shutdown(endpoint, httpServer.socket);
});

test("tls backend", async () => {
  const agent = await makeAgent();
  const endpoint = await agent.httpEndpoint().forward("https://dashboard.ngrok.com");

  await expect(async () => {
    await axios.get(endpoint.url());
  }).rejects.toThrow(AxiosError);

  const error = await axios.get(endpoint.url()).catch((e) => e);
  expect(error.response.status).toBe(421);
  expect(error.response.data.includes("different Host")).toBeTruthy();
  await endpoint.close();
});

test("unverified tls backend", async () => {
  const agent = await makeAgent();
  const endpoint = await agent
    .httpEndpoint()
    .forward("https://dashboard.ngrok.com", { verifyUpstreamTls: false });

  try {
    await axios.get(endpoint.url());
  } catch (error) {
    expect(error).toBeInstanceOf(AxiosError);
    expect(error.response.status).toBe(421);
    expect(error.response.data.includes("different Host")).toBeTruthy();
  }
  await endpoint.close();
});

// Covers what the old "http headers" test exercised (requestHeader/removeRequestHeader/
// responseHeader/removeResponseHeader builder methods), now expressed as a Traffic
// Policy document. See https://ngrok.com/docs/traffic-policy/actions/add-headers/ and
// .../remove-headers/.
test("traffic policy: headers", async () => {
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

  const agent = await makeAgent();
  const trafficPolicy = `
on_http_request:
  - actions:
      - type: add-headers
        config:
          headers:
            foo: bar
      - type: remove-headers
        config:
          headers:
            - baz
on_http_response:
  - actions:
      - type: add-headers
        config:
          headers:
            spam: eggs
      - type: remove-headers
        config:
          headers:
            - python
`;
  const endpoint = await agent
    .httpEndpoint()
    .trafficPolicy(trafficPolicy)
    .forward(httpServer.listenTo);

  const response = await validateAndShutdown(httpServer, endpoint, endpoint.url(), {
    headers: { baz: "req" },
  });
  expect("eggs").toBe(response.headers["spam"]);
  expect(undefined).toBe(response.headers["python"]);
});

// Covers what the old "basic auth" test exercised (the `basicAuth()` builder method),
// now expressed as a Traffic Policy document. See
// https://ngrok.com/docs/traffic-policy/actions/basic-auth/.
test("traffic policy: basic auth", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const trafficPolicy = `
on_http_request:
  - actions:
      - type: basic-auth
        config:
          credentials:
            - ngrok:online1line
`;
  const endpoint = await agent
    .httpEndpoint()
    .trafficPolicy(trafficPolicy)
    .forward(httpServer.listenTo);

  await validateAndShutdown(httpServer, endpoint, endpoint.url(), {
    auth: { username: "ngrok", password: "online1line" },
  });
});

test("custom domain", async () => {
  const domain = "d" + Math.floor(Math.random() * 1000000) + ".ngrok.io";
  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent.httpEndpoint().domain(domain).forward(httpServer.listenTo);

  expect("https://" + domain).toBe(endpoint.url());

  await validateAndShutdown(httpServer, endpoint, endpoint.url());
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

  const agent = await makeAgent();
  const endpoint = await agent
    .httpEndpoint()
    .forward("localhost:" + socket.address().port, { proxyProto: "1" });

  await axios.get(endpoint.url(), { timeout: 1000 }).catch((err) => {
    expect(err).toBeInstanceOf(AxiosError);
  });

  await shutdown(endpoint, socket);
});

// Covers what the old "ip restriction http" test exercised (the `allowCidr()`/
// `denyCidr()` builder methods), now expressed as a Traffic Policy document. See
// https://ngrok.com/docs/traffic-policy/actions/restrict-ips/.
test("traffic policy: ip restriction", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const trafficPolicy = `
on_http_request:
  - actions:
      - type: restrict-ips
        config:
          enforce: true
          allow:
            - 127.0.0.1/32
          deny:
            - 0.0.0.0/0
`;
  const endpoint = await agent
    .httpEndpoint()
    .trafficPolicy(trafficPolicy)
    .forward(httpServer.listenTo);

  const error = await axios.get(endpoint.url()).catch(async (err) => {
    expect(err).toBeInstanceOf(AxiosError);
    await shutdown(endpoint, httpServer.socket);
    return err;
  });
  expect(403).toBe(error.response.status);
});

test("tcp endpoint", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent.tcpEndpoint().metadata("tcp metadata").forward(httpServer.listenTo);

  expect(endpoint.id()).toBeTruthy();
  expect(endpoint.url()).toBeTruthy();
  expect("tcp metadata").toBe(endpoint.metadata());

  await validateAndShutdown(httpServer, endpoint, endpoint.url().replace("tcp:", "http:"));
});

// NOTE: custom TLS termination at the edge (previously `.termination(cert, key)`) is
// not currently exposed by this package -- see README for details. This only exercises
// endpoint creation, not a specific certificate.
test("tls endpoint", async () => {
  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent.tlsEndpoint().metadata("tls metadata").forward(httpServer.listenTo);

  expect(endpoint.id()).toBeTruthy();
  expect(endpoint.url()).toBeTruthy();
  expect("tls metadata").toBe(endpoint.metadata());

  await shutdown(endpoint, httpServer.socket);
});

test("smoke", async () => {
  const httpServer = await createHttpServer();
  const endpoint = await ngrok.listen(httpServer);
  const response = await axios.get(endpoint.url());
  expect(200).toBe(response.status);
  await shutdown(endpoint, endpoint.socket);
});

test("net listen", async () => {
  const httpServer = await createHttpServer();
  const endpoint = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(endpoint.url());
  await shutdown(endpoint, endpoint.socket);
});

test("express listen", async () => {
  const httpServer = await createExpress();
  const endpoint = await ngrok.listen(httpServer);
  const response = await validateHttpRequest(endpoint.url());
  await shutdown(endpoint, endpoint.socket);
});

// NOTE: this fork's `EndpointBuilder.listen()` never binds a local socket -- it only
// starts a raw endpoint that this package does not currently expose a way to accept
// connections on from JavaScript (see README). This just verifies it still produces a
// working endpoint.
test("raw listen", async () => {
  const agent = await makeAgent();
  const endpoint = await agent.httpEndpoint().listen();
  expect(endpoint.id()).toBeTruthy();
  expect(endpoint.url()).toBeTruthy();
  expect(endpoint.socket).toBe(undefined);
  await endpoint.close();
});

// run serially so other tests are not logging
test("console log", async () => {
  // register logging callback
  ngrok.consoleLog();
  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent.httpEndpoint().forward(httpServer.listenTo);
  await validateAndShutdown(httpServer, endpoint, endpoint.url());
  // unregister the callback
  ngrok.loggingCallback();
});

test("multipass", async () => {
  const [httpServer, agent1] = await makeHttpAndAgent();
  const agent2 = await makeAgent();
  const url = httpServer.listenTo;
  const endpoint1 = await agent1.httpEndpoint().forward(url);
  const endpoint2 = await agent1.httpEndpoint().forward(url);
  const endpoint3 = await agent2.httpEndpoint().forward(url);
  const endpoint4 = await agent2.tcpEndpoint().forward(url);

  expect(2).toBe((await agent1.endpoints()).length);
  expect(2).toBe((await agent2.endpoints()).length);
  expect((await ngrok.endpoints()).length >= 4).toBeTruthy();
  expect(endpoint3.url()).toBe((await ngrok.getEndpoint(endpoint3.id())).url());

  await validateHttpRequest(endpoint1.url());
  await validateHttpRequest(endpoint2.url());
  await validateHttpRequest(endpoint3.url());
  await validateHttpRequest(endpoint4.url().replace("tcp:", "http:"));

  await shutdown(endpoint1, httpServer.socket);
  await endpoint2.close();
  await agent2.disconnect();
});

// NOTE: `AgentBuilder.connect()` does not wait for the agent to actually finish
// authenticating -- it returns as soon as the reconnect loop is spawned (see
// ngrok-rust's `tunnel/reconnecting.rs`), so we can't just check event state
// synchronously after `await connect()` resolves like the old SDK's `handleHeartbeat`
// callback allowed. Instead, await the real `heartbeatReceived` event.
test("connect events", async () => {
  const heartbeatLatency = await new Promise((resolve) => {
    const builder = new ngrok.AgentBuilder().authtoken(process.env["NGROK_AUTHTOKEN"]);
    builder
      .clientInfo("connect_events", "1.2.3")
      .heartbeatInterval(5)
      .onEvent((event) => {
        if (event.kind === "heartbeatReceived") {
          resolve(event.latencyMs);
        }
      });
    builder.connect();
  });
  expect(heartbeatLatency > 0).toBeTruthy();
});

// NOTE: the old "session ca_cert" and "session incorrect authtoken" tests relied on
// `.connect()` rejecting when the initial authentication attempt failed. This fork's
// `AgentBuilder.connect()` never rejects for an auth/TLS failure at all -- per
// ngrok-rust's `tunnel/reconnecting.rs`, a failed `dial_and_auth` just logs a warning
// and retries forever with backoff; no event fires and no promise rejects. There is
// currently no way to observe an initial-connection failure from JavaScript, so those
// two tests have no working equivalent here and have been removed rather than kept as
// tests that would hang or pass vacuously.

test("endpoint invalid domain", async () => {
  const agent = await makeAgent();
  try {
    await agent.httpEndpoint().domain("1.21 gigawatts").listen();
  } catch (error) {
    expect(error.errorCode).toBe("ERR_NGROK_9034");
  }
});

test("traffic policy", async () => {
  const trafficPolicy = fs.readFileSync(path.resolve("__test__", "policy.json"), "utf8");

  const [httpServer, agent] = await makeHttpAndAgent();
  const endpoint = await agent
    .httpEndpoint()
    .trafficPolicy(trafficPolicy)
    .forward(httpServer.listenTo);
  const response = await validateAndShutdown(httpServer, endpoint, endpoint.url());
  expect("bar").toBe(response.headers["foo"]);
});
