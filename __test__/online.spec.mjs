import { NgrokSessionBuilder } from '../index.js'
import test from 'ava'
import axios, { AxiosError } from "axios";
import * as fs from 'fs';
import * as http from 'http';
import * as net from 'net';

const expected = 'Hello';

async function makeHttp(useUnixSocket) {
  const server = http.createServer(
    function(req,res){res.writeHead(200);
    res.write(expected);
    res.end();
  } )
  const listenTo = useUnixSocket ? ("tun-" + Math.floor(Math.random() * 1000000)) : 0;
  const socket = await server.listen(listenTo);
  server.socket = socket;
  server.listenTo = useUnixSocket ? listenTo : ('localhost:' + server.address().port);
  return server;
}

async function makeSession() {
  const builder = new NgrokSessionBuilder();
  return await builder
    .authtokenFromEnv()
    .metadata("session metadata")
    .connect();
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
  tunnel.forwardTcp(httpServer.listenTo)
  const response = await validateHttpRequest(t, url, axiosConfig);
  await shutdown(tunnel, httpServer.socket);
  return response;
}

test('https tunnel', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .forwardsTo("http forwards to")
    .metadata("http metadata")
    .listen();

  t.truthy(tunnel.id());
  t.truthy(tunnel.url());
  t.truthy(tunnel.url().startsWith("https://"), tunnel.url());
  t.is("http forwards to", tunnel.forwardsTo());
  t.is("http metadata", tunnel.metadata());

  await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url());
});

test('http tunnel', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .scheme("hTtP")
    .listen();

  t.truthy(tunnel.url().startsWith("http://"), tunnel.url());

  await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url());
});

test('unix socket', async (t) => {
  const [httpServer, session] = await makeHttpAndSession(true);
  const tunnel = await session.httpEndpoint().listen();
  t.truthy(httpServer.listenTo.startsWith("tun-"), httpServer.listenTo);
  tunnel.forwardUnix(httpServer.listenTo)
  const response = await validateHttpRequest(t, tunnel.url());
  await shutdown(tunnel, httpServer.socket);
});

test('gzip tunnel', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .compression()
    .listen();

  tunnel.forwardTcp(httpServer.listenTo)

  const response = await axios.get(tunnel.url(), {'decompress': false});
  t.is("gzip", response.headers["content-encoding"]);
  await shutdown(tunnel, httpServer.socket);
});

test('http headers', async (t) => {
  const httpServer = http.createServer(
    function(req,res){
      const { headers } = req;
      t.is("bar", headers['foo']);
      t.is(undefined, headers['baz']);
      res.writeHead(200, {'python':'sss'});
      res.write(expected);
      res.end();
  } );
  const socket = await httpServer.listen(0);
  httpServer.socket = socket;
  httpServer.listenTo = 'localhost:' + httpServer.address().port;

  const session = await makeSession();
  const tunnel = await session.httpEndpoint()
    .requestHeader("foo", "bar")
    .removeRequestHeader("baz")
    .responseHeader("spam", "eggs")
    .removeResponseHeader("python")
    .listen();

  const response = await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url(),
    {'headers': {'baz':'req'}});
  t.is("eggs", response.headers["spam"]);
  t.is(undefined, response.headers["python"]);
});

test('basic auth', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .basicAuth("ngrok", "online1line")
    .listen();

  tunnel.forwardTcp(httpServer.listenTo)

  const response = await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url(),
    {auth: {username: 'ngrok', password: 'online1line'}});
});

test('oauth', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .oauth("google")
    .listen();

  tunnel.forwardTcp(httpServer.listenTo)

  const response = await axios.get(tunnel.url());
  t.not(expected, response.data);
  t.truthy(response.data.includes("google-site-verification"));
  await shutdown(tunnel, httpServer.socket);
});

test('custom domain', async (t) => {
  const domain = "d" + Math.floor(Math.random() * 1000000) + ".ngrok.io";
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .domain(domain)
    .listen();

  t.is("https://" + domain, tunnel.url());

  await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url());
});

test('proxy proto', async (t) => {
  const tcpServer = net.createServer(function(c) {
    c.on('readable', function() {
      var chunk, N = 10;
      while (null !== (chunk = c.read(N))) {
        const utf8Encode = new TextEncoder();
        const bytes = utf8Encode.encode("PROXY TCP4");
        t.deepEqual(Buffer.from(bytes), chunk);
        break;
      }
    })
  });
  const socket = await tcpServer.listen(0);

  const session = await makeSession();
  const tunnel = await session.httpEndpoint()
    .proxyProto("1")
    .listen();

  tunnel.forwardTcp('localhost:' + socket.address().port)

  const error = await t.throwsAsync(async () => {
    await axios.get(tunnel.url(), {timeout:1000});
  }, {instanceOf: AxiosError});
  await shutdown(tunnel, socket);
});

test('ip restriction http', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(t, httpServer, session.httpEndpoint());
  t.is(403, error.response.status);
});

test('ip restriction tcp', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const error = await ipRestriction(t, httpServer, session.tcpEndpoint());
  t.is("ECONNRESET", error.code);
});

async function ipRestriction(t, httpServer, tunnelBuilder) {
  const tunnel = await tunnelBuilder
    .allowCidr("127.0.0.1/32")
    .denyCidr("0.0.0.0/0")
    .listen();

  tunnel.forwardTcp(httpServer.listenTo)
  const error = await t.throwsAsync(async () => {
    await axios.get(tunnel.url().replace('tcp:','http:'));
  }, {instanceOf: AxiosError});
  await shutdown(tunnel, httpServer.socket);
  return error;
};

test('websocket conversion', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.httpEndpoint()
    .websocketTcpConversion()
    .listen();

  tunnel.forwardTcp(httpServer.listenTo)

  const error = await t.throwsAsync(async () => {
    await axios.get(tunnel.url());
  }, {instanceOf: AxiosError});
  // ERR_NGROK_3206: Expected a websocket request with a "Connection: upgrade" header
  // but did not receive one.
  t.is("ERR_NGROK_3206", error.response.headers["ngrok-error-code"]);
  await shutdown(tunnel, httpServer.socket);
});

test('tcp tunnel', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.tcpEndpoint()
    .forwardsTo("tcp forwards to")
    .metadata("tcp metadata")
    .listen();

  t.truthy(tunnel.id());
  t.truthy(tunnel.url());
  t.is("tcp forwards to", tunnel.forwardsTo());
  t.is("tcp metadata", tunnel.metadata());

  await forwardValidateShutdown(t, httpServer, tunnel, tunnel.url().replace("tcp:", "http:"));
});

test('tls tunnel', async (t) => {
  const [httpServer, session] = await makeHttpAndSession();
  const tunnel = await session.tlsEndpoint()
    .forwardsTo("tcp forwards to")
    .metadata("tcp metadata")
    .termination(fs.readFileSync('examples/domain.crt'), fs.readFileSync('examples/domain.key'))
    .listen();

  t.truthy(tunnel.id());
  t.truthy(tunnel.url());
  t.is("tcp forwards to", tunnel.forwardsTo());
  t.is("tcp metadata", tunnel.metadata());

  tunnel.forwardTcp(httpServer.listenTo)
  const error = await t.throwsAsync(async () => {
    await axios.get(tunnel.url().replace("tls:", "https:"));
  }, {instanceOf: AxiosError});
  t.truthy(error.message.endsWith('signed certificate'), error.message);
  await shutdown(tunnel, httpServer.socket);
});
