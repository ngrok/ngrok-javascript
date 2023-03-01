//
// javascript trailer
//

const net = require('net');
const fs = require('fs');
const os = require('os');

NgrokHttpTunnelBuilder.prototype.bind = ngrokBind;
NgrokTcpTunnelBuilder.prototype.bind = ngrokBind;
NgrokTlsTunnelBuilder.prototype.bind = ngrokBind;
NgrokLabeledTunnelBuilder.prototype.bind = ngrokBind;

// Begin listening for new connections on this tunnel,
// and bind to a local socket so this tunnel can be 
// passed directly into net.Server.listen.
async function ngrokBind() {
  const socket = await randomTcpSocket();
  const tunnel = await this.listen();
  tunnel.forwardTcp('localhost:' + socket.address().port);
  defineTunnelHandle(tunnel, socket);
  return tunnel;
}

// add a 'handle' getter to the tunnel so it can be
// passed directly into net.Server.listen.
function defineTunnelHandle(tunnel, socket) {
  // NodeJS net.Server asks passed-in object for 'handle',
  // Return the native TCP object so the pre-existing socket is used.
  Object.defineProperty( tunnel, 'handle', {
    get: function() {
      return socket._handle;
    }
  });
}

// generate a net.Server listening to a random port
async function randomTcpSocket() {
  return await asyncListen(new net.Server(), {host:'localhost', port:0});
}

// NodeJS has not promisified 'net': https://github.com/nodejs/node/issues/21482
function asyncListen(server, options) {
  return new Promise((resolve, reject) => {
    const socket = server.listen(options);
    socket.once('listening', () => {
      resolve(socket);
    })
    .once('error', (err) => {
      reject(err);
    });
  });
}

// Make a session using NGROK_AUTHTOKEN from the environment,
// and then return a listening HTTP tunnel.
async function defaultTunnel() {
  // set up a default session and tunnel
  var builder = new NgrokSessionBuilder();
  builder.authtokenFromEnv();
  var session = await builder.connect();
  var tunnel = await session.httpEndpoint().listen();
  tunnel.session = session; // surface to caller
  return tunnel;
}

// Get a listenable ngrok tunnel, optionally passing in a pre-existing tunnel
async function listenable(tunnel) {
  if (!tunnel) {
    tunnel = await defaultTunnel();
  }
  // use tcp socket with random local port
  const socket = await randomTcpSocket();
  // forward to this socket
  tunnel.forwardTcp('localhost:' + socket.address().port);
  // make it work with net.Servers
  defineTunnelHandle(tunnel, socket);
  return tunnel;
}

// Bind a server to a ngrok tunnel, optionally passing in a pre-existing tunnel
async function ngrokListen(server, tunnel) {
  if (!tunnel) {
    tunnel = await defaultTunnel();
  }
  // todo: abstract socket on linux: https://stackoverflow.com/a/60014174
  // todo: named pipe on windows: https://nodejs.org/api/net.html#ipc-support

  // attempt unix socket
  var socket;
  try {
    socket = await ngrokLinkUnix(tunnel, server);
  } catch (err) {
    console.debug("Using TCP socket. " + err);
    // fallback to tcp socket
    socket = await ngrokLinkTcp(tunnel, server);
  }
  registerCleanup(tunnel, socket);

  server.tunnel = tunnel; // surface to caller
  socket.tunnel = tunnel; // surface to caller
  // return the newly created net.Server, which will be different in the express case
  return socket;
}

async function ngrokLinkTcp(tunnel, server) {
  // random local port
  const socket = await asyncListen(server, {host:'localhost', port:0});
  // forward to socket
  tunnel.forwardTcp('localhost:' + socket.address().port);
  return socket;
}

async function ngrokLinkUnix(tunnel, server) {
  const proposed = "tun-" + tunnel.id() + ".sock";
  var filename;
  try {
    fs.accessSync(process.cwd(), fs.constants.W_OK);
    filename = proposed;
  } catch (err) {
    console.debug("Cannot write to: " + process.cwd());
    // try tmp. allow any exception to propagate
    fs.accessSync(os.tmpdir(), fs.constants.W_OK);
    filename = os.tmpdir() + proposed;
  }

  if (!filename) {
    throw new Error("no writeable directory found");
  }

  // begin listening
  const socket = await asyncListen(server, {path: filename});
  // tighten permissions
  try {
    fs.chmodSync(filename, fs.constants.S_IRWXU);
  } catch (err) {
    console.debug("Cannot change permissions of file: " + filename);
  }
  // forward tunnel
  tunnel.forwardUnix(filename);
  socket.path = filename; // surface to caller

  return socket;
}

function registerCleanup(tunnel, socket) {
  process.on('SIGINT', function() {
    if (process.listenerCount('SIGINT') > 1) {
      // user has registered a handler, abort this one
      return;
    }
    // close tunnel
    if (tunnel) {
      tunnel.close().then(()=>{
        console.debug('ngrok closed tunnel: ' + tunnel.id());
      });
    }
    // close webserver's socket
    if (socket) {
      socket.close(function () {
        console.debug('ngrok closed socket');
      });
    }
    // unregister any logging callback
    loggingCallback();
  });
}

function consoleLog(level) {
  loggingCallback((level, target, message) => {
    console.log(`${level} ${target} - ${message}`);
  }, level);
}

module.exports.listenable = listenable;
module.exports.listen = ngrokListen;
module.exports.consoleLog = consoleLog;
