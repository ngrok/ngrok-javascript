//
// javascript trailer!
//

const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

// wrap listen with the bind code for passing to net.Server.listen()
NgrokHttpTunnelBuilder.prototype._listen = NgrokHttpTunnelBuilder.prototype.listen;
NgrokTcpTunnelBuilder.prototype._listen = NgrokTcpTunnelBuilder.prototype.listen;
NgrokTlsTunnelBuilder.prototype._listen = NgrokTlsTunnelBuilder.prototype.listen;
NgrokLabeledTunnelBuilder.prototype._listen = NgrokLabeledTunnelBuilder.prototype.listen;

NgrokHttpTunnelBuilder.prototype.listen = ngrokBind;
NgrokTcpTunnelBuilder.prototype.listen = ngrokBind;
NgrokTlsTunnelBuilder.prototype.listen = ngrokBind;
NgrokLabeledTunnelBuilder.prototype.listen = ngrokBind;

// Begin listening for new connections on this tunnel,
// and bind to a local socket so this tunnel can be
// passed into net.Server.listen().
async function ngrokBind(bind) {
  const tunnel = await this._listen();
  if (bind !== false) {
    const socket = await randomTcpSocket();
    tunnel.socket = socket;
    defineTunnelHandle(tunnel, socket);
  }
  return tunnel;
}

// add a 'handle' getter to the tunnel so it can be
// passed into net.Server.listen().
function defineTunnelHandle(tunnel, socket) {
  // NodeJS net.Server asks passed-in object for 'handle',
  // Return the native TCP object so the pre-existing socket is used.
  Object.defineProperty(tunnel, "handle", {
    get: function () {
      // turn on forwarding now that it has been requested
      tunnel.forwardTcp("localhost:" + socket.address().port);
      return socket._handle;
    },
  });
}

// generate a net.Server listening to a random port
async function randomTcpSocket() {
  return await asyncListen(new net.Server(), { host: "localhost", port: 0 });
}

// NodeJS has not promisified 'net': https://github.com/nodejs/node/issues/21482
function asyncListen(server, options) {
  return new Promise((resolve, reject) => {
    const socket = server.listen(options);
    socket
      .once("listening", () => {
        resolve(socket);
      })
      .once("error", (err) => {
        reject(err);
      });
  });
}

// Make a session using NGROK_AUTHTOKEN from the environment,
// and then return a listening HTTP tunnel.
async function defaultTunnel(bind) {
  // set up a default session and tunnel
  var builder = new NgrokSessionBuilder();
  builder.authtokenFromEnv();
  var session = await builder.connect();
  var tunnel = await session.httpEndpoint().listen(bind);
  tunnel.session = session; // surface to caller
  return tunnel;
}

// Get a listenable ngrok tunnel, suitable for passing to net.Server.listen().
// Uses the NGROK_AUTHTOKEN environment variable to authenticate.
async function listenable() {
  return await defaultTunnel();
}

// Bind a server to a new ngrok tunnel, optionally passing in a pre-existing tunnel instead.
// Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new tunnel is created.
async function ngrokListen(server, tunnel) {
  if (tunnel && tunnel.socket) {
    // close the default bound port
    tunnel.socket.close();
  }
  if (!tunnel) {
    // turn off automatic bind
    tunnel = await defaultTunnel(false);
  }

  // attempt pipe socket
  try {
    socket = await ngrokLinkPipe(tunnel, server);
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
  const socket = await asyncListen(server, { host: "localhost", port: 0 });
  // forward to socket
  tunnel.forwardTcp("localhost:" + socket.address().port);
  return socket;
}

function generatePipeFilename(tunnel, server) {
  var proposed = "tun-" + tunnel.id() + ".sock";

  // windows leaves little choice
  if (platform == "win32") {
    return "\\\\.\\pipe\\" + proposed;
  }

  // try to make a directory in the current working directory
  const dir = ".ngrok";
  try {
    fs.mkdirSync(dir);
  } catch (err) {
    // move on
  }
  try {
    fs.accessSync(dir, fs.constants.W_OK);
    return dir + path.sep + proposed;
  } catch (err) {
    // move on
  }

  // try the OS temp directory, being careful not to exceed the maximum path length for unix sockets
  // https://linux.die.net/man/7/unix
  // https://unix.stackexchange.com/a/367012
  if (os.tmpdir().length < 90) {
    try {
      fs.accessSync(os.tmpdir(), fs.constants.W_OK);
      filepath = os.tmpdir() + path.sep + proposed;
      if (filepath.length > 100) {
        // truncate
        filepath = filepath.substring(0, 100);
      }
      return filepath;
    } catch (err) {
      // move on
    }
  }

  // fallback to current working directory. allow any exception to propagate
  fs.accessSync(process.cwd(), fs.constants.W_OK);
  return proposed;
}

async function ngrokLinkPipe(tunnel, server) {
  var filename = generatePipeFilename(tunnel);
  // begin listening
  const socket = await asyncListen(server, { path: filename });
  // tighten permissions
  try {
    if (platform != "win32") {
      fs.chmodSync(filename, fs.constants.S_IRWXU);
    }
  } catch (err) {
    console.debug("Cannot change permissions of file: " + filename);
  }
  // forward tunnel
  tunnel.forwardPipe(filename);
  socket.path = filename; // surface to caller

  return socket;
}

// protect against multiple calls, for instance from npm
var sigintRan = false;

function registerCleanup(tunnel, socket) {
  process.on("SIGINT", function () {
    if (sigintRan) return;
    sigintRan = true;

    if (process.listenerCount("SIGINT") > 1) {
      // user has registered a handler, abort this one
      return;
    }
    // close tunnel
    if (tunnel) {
      tunnel.close().catch((err) => {
        console.error(`Error closing tunnel: ${err}`);
      });
    }
    // close webserver's socket
    if (socket) socket.close();
    // unregister any logging callback
    loggingCallback();
  });
}

function consoleLog(level) {
  loggingCallback((level, target, message) => {
    console.log(`${level} ${target} - ${message}`);
  }, level);
}

// wrap connect with code to vectorize and split out functions
const _connect = connect;
async function ngrokConnect(config) {
  if (config == undefined) config = 80;
  if (Number.isInteger(config) || typeof config === "string" || config instanceof String) {
    address = String(config);
    if (!address.includes(":")) {
      address = `localhost:${address}`;
    }
    config = { addr: address };
  }
  // Convert addr to string to allow for numeric port numbers
  const addr = config["addr"];
  if (Number.isInteger(addr)) config["addr"] = "localhost:" + String(config["addr"]);
  // convert scalar values to arrays to meet what napi-rs expects
  [
    "auth",
    "basic_auth",
    "ip_restriction.allow_cidrs",
    "ip_restriction.deny_cidrs",
    "labels",
    "oauth.allow_domains",
    "oauth.allow_emails",
    "oauth.scopes",
    "oidc.scopes",
    "oidc.allow_domains",
    "oidc.allow_emails",
    "request_header.add",
    "request_header.remove",
    "response_header.add",
    "response_header.remove",
    "schemes",
  ].forEach((key) => {
    vectorize(config, key);
  });
  // convert dotted values to underscores for backwards compatibility
  [
    "ip_restriction.allow_cidrs",
    "ip_restriction.deny_cidrs",
    "oauth.allow_domains",
    "oauth.allow_emails",
    "oauth.scopes",
    "oauth.provider",
    "oidc.client_id",
    "oidc.client_secret",
    "oidc.scopes",
    "oidc.issuer_url",
    "oidc.allow_domains",
    "oidc.allow_emails",
    "request_header.add",
    "request_header.remove",
    "response_header.add",
    "response_header.remove",
    "verify_webhook.provider",
    "verify_webhook.secret",
  ].forEach((key) => {
    undot(config, key);
  });
  // break out the logging callback function to meet what napi-rs expects
  var on_log_event;
  if (config["onLogEvent"]) {
    const onLogEvent = config.onLogEvent;
    on_log_event = (level, target, message) => {
      onLogEvent(`${level} ${target} - ${message}`);
    };
    config["onLogEvent"] = true;
  }
  // break out the status change callback functions to what napi-rs expects
  var on_connection, on_disconnection;
  if (config["onStatusChange"]) {
    const onStatusChange = config.onStatusChange;
    on_connection = (status, err) => {
      onStatusChange(status);
    };
    on_disconnection = (addr, err) => {
      onStatusChange("closed");
    };
    config["onStatusChange"] = true;
  }
  // call into rust
  return await _connect(config, on_log_event, on_connection, on_disconnection);
}

function undot(config, dotKey) {
  const noDotKey = dotKey.replace(".", "_");
  if (config[dotKey] == null) return; // no dotKey value, done
  if (config[noDotKey] == null) {
    // nothing at destination, just set and be done
    config[noDotKey] = config[dotKey];
    return;
  }
  if (config[dotKey] instanceof Array && config[noDotKey] instanceof Array) {
    // merge arrays
    for (const obj of config[dotKey]) {
      config[noDotKey].push(obj);
    }
  }
  // destination exists and is not an array, do nothing so noDotKey can take precedence
}

function vectorize(config, key) {
  // backwards compatible keys are passed in, check the new style as well
  const noDotKey = key.replace(".", "_");
  if (key != noDotKey) vectorize(config, noDotKey);

  if (config[key] == null) return; // no value, done
  if (!(config[key] instanceof Array)) {
    config[key] = [config[key]];
  }
}

module.exports.connect = ngrokConnect;
module.exports.consoleLog = consoleLog;
module.exports.listen = ngrokListen;
module.exports.listenable = listenable;
