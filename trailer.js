//
// javascript trailer
//

// wrap methods that can surface ngrok cloud errors so `err.errorCode` gets populated.
wrapErrorCode(AgentBuilder.prototype, "connect");
wrapErrorCode(EndpointBuilder.prototype, "listen");
wrapErrorCode(EndpointBuilder.prototype, "forward");

// serve() binds a local socket for `server`, then forwards the endpoint to it in one step.
EndpointBuilder.prototype.serve = serve;

function wrapErrorCode(proto, methodName) {
  const orig = proto[methodName];
  proto[methodName] = async function (...args) {
    try {
      return await orig.apply(this, args);
    } catch (err) {
      populateErrorCode(err);
      throw err;
    }
  };
}

/// Begin listening for new connections on this endpoint and forwarding them to the given server.
async function serve(server) {
  const socket = await bindLocalServer(server);
  const endpoint = await this.forward(localAddr(socket));
  linkServerAndEndpoint(server, socket, endpoint);
  return endpoint;
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

// bind a net.Server to a local TCP socket, so a public endpoint can be forwarded to it.
//
// NOTE: this fork's `Upstream` dialer only ever dials plain TCP (see
// `resolve_upstream_addr` in ngrok-rust's agent.rs) -- it silently resolves any
// `unix:`/`pipe:`-prefixed address to `localhost:80` instead of failing, rather than
// actually dialing a unix domain socket or Windows named pipe. So unlike the old SDK,
// we can't bind a local pipe here and forward to it -- TCP is the only address kind
// that will actually reach the local server.
async function bindLocalServer(server) {
  return await ngrokLinkTcp(server);
}

async function ngrokLinkTcp(server) {
  return await asyncListen(server, { host: "localhost", port: 0 });
}

function localAddr(socket) {
  return "localhost:" + socket.address().port;
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

// protect against multiple calls, for instance from npm
var sigHandlerRan = false;

function linkServerAndEndpoint(server, socket, endpoint) {
  endpoint.socket = socket; // surface to caller
  server.endpoint = endpoint; // surface to caller
  socket.endpoint = endpoint; // surface to caller
  registerCleanup(endpoint, socket);
}

function registerCleanup(endpoint, socket) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, function () {
      if (process.listenerCount(signal) > 1) {
        // user has registered a handler, abort this one
        return;
      }

      if (sigHandlerRan) return;
      sigHandlerRan = true;

      // close endpoint
      if (endpoint) {
        endpoint.close().catch((err) => {
          console.error(`Error closing endpoint: ${err}`);
        });
      }
      // close webserver's socket
      if (socket) socket.close();
      // unregister any logging callback
      loggingCallback();
    });
  }
}

function consoleLog(level) {
  loggingCallback((level, target, message) => {
    console.log(`${level} ${target} - ${message}`);
  }, level);
}

// wrap forward with code to break out callback functions the way napi-rs expects
const _forward = forward;
async function ngrokForward(config) {
  if (config == undefined) config = 80;
  if (Number.isInteger(config) || typeof config === "string" || config instanceof String) {
    address = String(config);
    if (Number.isInteger(config) && !address.includes(":")) {
      address = `localhost:${address}`;
    }
    config = { addr: address };
  }
  if (typeof config["port"] === "string" || config["port"] instanceof String) {
    const num = parseInt(config["port"], 10);
    if (isNaN(num)) {
      throw new Error(`port must be a number: '${config["port"]}'`);
    }
    config["port"] = num;
  }
  // Convert addr to string to allow for numeric port numbers
  const addr = config["addr"];
  if (Number.isInteger(addr)) config["addr"] = "localhost:" + String(config["addr"]);
  // break out the logging callback function to meet what napi-rs expects
  var on_log_event;
  if (config["onLogEvent"]) {
    const onLogEvent = config.onLogEvent;
    on_log_event = (level, target, message) => {
      onLogEvent(`${level} ${target} - ${message}`);
    };
    config["onLogEvent"] = true;
  }
  // break out the status change callback function to meet what napi-rs expects
  var on_status_change;
  if (config["onStatusChange"]) {
    const onStatusChange = config.onStatusChange;
    on_status_change = (status) => {
      onStatusChange(status);
    };
    config["onStatusChange"] = true;
  }
  // call into rust
  try {
    return await _forward(config, on_log_event, on_status_change);
  } catch (err) {
    populateErrorCode(err);
    throw err;
  }
}

// Bind `server` to a local socket, create/reuse the default agent (via NGROK_AUTHTOKEN),
// and forward a new endpoint to it in one step. `config` accepts the same options as
// {@link forward}, minus `addr` (which is always the freshly bound local socket).
async function ngrokListen(server, config) {
  const socket = await bindLocalServer(server);
  const fullConfig = Object.assign({}, config, { addr: localAddr(socket) });
  const endpoint = await ngrokForward(fullConfig);
  linkServerAndEndpoint(server, socket, endpoint);
  return endpoint;
}

module.exports.connect = ngrokForward;
module.exports.forward = ngrokForward;
module.exports.consoleLog = consoleLog;
module.exports.listen = ngrokListen;
