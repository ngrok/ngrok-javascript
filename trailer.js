//
// javascript trailer
//

const net = require("net");
const fs = require("fs");
const os = require("os");
const path = require("path");

// wrap connect with the code for extending exception with error code
SessionBuilder.prototype._connect = SessionBuilder.prototype.connect;
SessionBuilder.prototype.connect = ngrokSessionConnect;

// wrap listen with the bind code for passing to net.Server.listen()
HttpListenerBuilder.prototype._listen = HttpListenerBuilder.prototype.listen;
TcpListenerBuilder.prototype._listen = TcpListenerBuilder.prototype.listen;
TlsListenerBuilder.prototype._listen = TlsListenerBuilder.prototype.listen;
LabeledListenerBuilder.prototype._listen = LabeledListenerBuilder.prototype.listen;

HttpListenerBuilder.prototype.listen = ngrokBind;
TcpListenerBuilder.prototype.listen = ngrokBind;
TlsListenerBuilder.prototype.listen = ngrokBind;
LabeledListenerBuilder.prototype.listen = ngrokBind;

HttpListenerBuilder.prototype.listenAndServe = listenAndServe;
TcpListenerBuilder.prototype.listenAndServe = listenAndServe;
TlsListenerBuilder.prototype.listenAndServe = listenAndServe;
LabeledListenerBuilder.prototype.listenAndServe = listenAndServe;

// Wrap session connect to fill in exception's errorCode
async function ngrokSessionConnect() {
  try {
    return await this._connect();
  } catch (err) {
    populateErrorCode(err);
    throw err;
  }
}

// Begin listening for new connections on this listener,
// and bind to a local socket so this listener can be
// passed into net.Server.listen().
async function ngrokBind(bind) {
  try {
    const listener = await this._listen();
    if (bind !== false) {
      const socket = await randomTcpSocket();
      listener.socket = socket;
      defineListenerHandle(listener, socket);
    }
    return listener;
  } catch (err) {
    populateErrorCode(err);
    throw err;
  }
}

/// Begin listening for new connections on this listener and forwarding them to the given server.
async function listenAndServe(server) {
  const listener = await this._listen();
  listener.socket = await ngrokListen(server, listener);
  return listener;
}

function populateErrorCode(err) {
  if (err.message) {
    const regex = /error_code: (ERR_NGROK_\d+)$/;
    const errorCode = err.message.match(regex);
    if (errorCode && errorCode.length > 1) {
      err.errorCode = errorCode[1];
    }
  }
}

// add a 'handle' getter to the listener so it can be
// passed into net.Server.listen().
function defineListenerHandle(listener, socket) {
  // NodeJS net.Server asks passed-in object for 'handle',
  // Return the native TCP object so the pre-existing socket is used.
  Object.defineProperty(listener, "handle", {
    get: function () {
      // turn on forwarding now that it has been requested
      listener.forward("localhost:" + socket.address().port);
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
// and then return a listening HTTP listener.
async function defaultListener(bind) {
  // set up a default session and listener
  var builder = new SessionBuilder();
  builder.authtokenFromEnv();
  var session = await builder.connect();
  var listener = await session.httpEndpoint().listen(bind);
  listener.session = session; // surface to caller
  return listener;
}

// Get a listenable ngrok listener, suitable for passing to net.Server.listen().
// Uses the NGROK_AUTHTOKEN environment variable to authenticate.
async function listenable() {
  return await defaultListener();
}

// Bind a server to a new ngrok listener, optionally passing in a pre-existing listener instead.
// Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new listener is created.
async function ngrokListen(server, listener) {
  if (listener && listener.socket) {
    // close the default bound port
    listener.socket.close();
  }
  if (!listener) {
    // turn off automatic bind
    listener = await defaultListener(false);
  }

  // attempt pipe socket
  try {
    socket = await ngrokLinkPipe(listener, server);
  } catch (err) {
    console.debug("Using TCP socket. " + err);
    // fallback to tcp socket
    socket = await ngrokLinkTcp(listener, server);
  }
  registerCleanup(listener, socket);

  server.listener = listener; // surface to caller
  socket.listener = listener; // surface to caller
  // return the newly created net.Server, which will be different in the express case
  return socket;
}

async function ngrokLinkTcp(listener, server) {
  // random local port
  const socket = await asyncListen(server, { host: "localhost", port: 0 });
  // forward to socket
  listener.forward("localhost:" + socket.address().port);
  return socket;
}

function generatePipeFilename(listener, server) {
  var proposed = "tun-" + listener.id() + ".sock";

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

async function ngrokLinkPipe(listener, server) {
  var filename = generatePipeFilename(listener);
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
  // forward listener
  var addr = "unix:" + filename;
  if (platform == "win32") {
    // convert pipe path to url
    addr = "pipe:" + filename.replace("\\\\.\\pipe\\", "//./");
  }
  listener.forward(addr);
  socket.path = filename; // surface to caller

  return socket;
}

// protect against multiple calls, for instance from npm
var sigintRan = false;

function registerCleanup(listener, socket) {
  process.on("SIGINT", function () {
    if (sigintRan) return;
    sigintRan = true;

    if (process.listenerCount("SIGINT") > 1) {
      // user has registered a handler, abort this one
      return;
    }
    // close listener
    if (listener) {
      listener.close().catch((err) => {
        console.error(`Error closing listener: ${err}`);
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
    if (Number.isInteger(config) && !address.includes(":")) {
      address = `localhost:${address}`;
    }
    config = { addr: address };
  }
  // Convert addr to string to allow for numeric port numbers
  const addr = config["addr"];
  if (Number.isInteger(addr)) config["addr"] = "localhost:" + String(config["addr"]);
  // convert scalar values to arrays to meet what napi-rs expects
  [
    "allow_user_agent",
    "auth",
    "basic_auth",
    "deny_user_agent",
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
  try {
    return await _connect(config, on_log_event, on_connection, on_disconnection);
  } catch (err) {
    populateErrorCode(err);
    throw err;
  }
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
