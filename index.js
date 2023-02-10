const { existsSync, readFileSync } = require('fs')
const { join } = require('path')

const { platform, arch } = process

let nativeBinding = null
let localFileExisted = false
let loadError = null

function isMusl() {
  // For Node 10
  if (!process.report || typeof process.report.getReport !== 'function') {
    try {
      const lddPath = require('child_process').execSync('which ldd').toString().trim();
      return readFileSync(lddPath, 'utf8').includes('musl')
    } catch (e) {
      return true
    }
  } else {
    const { glibcVersionRuntime } = process.report.getReport().header
    return !glibcVersionRuntime
  }
}

switch (platform) {
  case 'android':
    switch (arch) {
      case 'arm64':
        localFileExisted = existsSync(join(__dirname, 'ngrok.android-arm64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.android-arm64.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-android-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm':
        localFileExisted = existsSync(join(__dirname, 'ngrok.android-arm-eabi.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.android-arm-eabi.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-android-arm-eabi')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Android ${arch}`)
    }
    break
  case 'win32':
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(
          join(__dirname, 'ngrok.win32-x64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.win32-x64-msvc.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-win32-x64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'ia32':
        localFileExisted = existsSync(
          join(__dirname, 'ngrok.win32-ia32-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.win32-ia32-msvc.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-win32-ia32-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'ngrok.win32-arm64-msvc.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.win32-arm64-msvc.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-win32-arm64-msvc')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Windows: ${arch}`)
    }
    break
  case 'darwin':
    localFileExisted = existsSync(join(__dirname, 'ngrok.darwin-universal.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./ngrok.darwin-universal.node')
      } else {
        nativeBinding = require('@ngrok/ngrok-darwin-universal')
      }
      break
    } catch {}
    switch (arch) {
      case 'x64':
        localFileExisted = existsSync(join(__dirname, 'ngrok.darwin-x64.node'))
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.darwin-x64.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-darwin-x64')
          }
        } catch (e) {
          loadError = e
        }
        break
      case 'arm64':
        localFileExisted = existsSync(
          join(__dirname, 'ngrok.darwin-arm64.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.darwin-arm64.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-darwin-arm64')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on macOS: ${arch}`)
    }
    break
  case 'freebsd':
    if (arch !== 'x64') {
      throw new Error(`Unsupported architecture on FreeBSD: ${arch}`)
    }
    localFileExisted = existsSync(join(__dirname, 'ngrok.freebsd-x64.node'))
    try {
      if (localFileExisted) {
        nativeBinding = require('./ngrok.freebsd-x64.node')
      } else {
        nativeBinding = require('@ngrok/ngrok-freebsd-x64')
      }
    } catch (e) {
      loadError = e
    }
    break
  case 'linux':
    switch (arch) {
      case 'x64':
        if (isMusl()) {
          localFileExisted = existsSync(
            join(__dirname, 'ngrok.linux-x64-musl.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./ngrok.linux-x64-musl.node')
            } else {
              nativeBinding = require('@ngrok/ngrok-linux-x64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(
            join(__dirname, 'ngrok.linux-x64-gnu.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./ngrok.linux-x64-gnu.node')
            } else {
              nativeBinding = require('@ngrok/ngrok-linux-x64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm64':
        if (isMusl()) {
          localFileExisted = existsSync(
            join(__dirname, 'ngrok.linux-arm64-musl.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./ngrok.linux-arm64-musl.node')
            } else {
              nativeBinding = require('@ngrok/ngrok-linux-arm64-musl')
            }
          } catch (e) {
            loadError = e
          }
        } else {
          localFileExisted = existsSync(
            join(__dirname, 'ngrok.linux-arm64-gnu.node')
          )
          try {
            if (localFileExisted) {
              nativeBinding = require('./ngrok.linux-arm64-gnu.node')
            } else {
              nativeBinding = require('@ngrok/ngrok-linux-arm64-gnu')
            }
          } catch (e) {
            loadError = e
          }
        }
        break
      case 'arm':
        localFileExisted = existsSync(
          join(__dirname, 'ngrok.linux-arm-gnueabihf.node')
        )
        try {
          if (localFileExisted) {
            nativeBinding = require('./ngrok.linux-arm-gnueabihf.node')
          } else {
            nativeBinding = require('@ngrok/ngrok-linux-arm-gnueabihf')
          }
        } catch (e) {
          loadError = e
        }
        break
      default:
        throw new Error(`Unsupported architecture on Linux: ${arch}`)
    }
    break
  default:
    throw new Error(`Unsupported OS: ${platform}, architecture: ${arch}`)
}

if (!nativeBinding) {
  if (loadError) {
    throw loadError
  }
  throw new Error(`Failed to load native binding`)
}

const { NgrokSessionBuilder, tracingSubscriber, NgrokSession, NgrokHttpTunnel, NgrokTcpTunnel, NgrokTlsTunnel, NgrokLabeledTunnel, NgrokHttpTunnelBuilder, NgrokTcpTunnelBuilder, NgrokTlsTunnelBuilder, NgrokLabeledTunnelBuilder } = nativeBinding

module.exports.NgrokSessionBuilder = NgrokSessionBuilder
module.exports.tracingSubscriber = tracingSubscriber
module.exports.NgrokSession = NgrokSession
module.exports.NgrokHttpTunnel = NgrokHttpTunnel
module.exports.NgrokTcpTunnel = NgrokTcpTunnel
module.exports.NgrokTlsTunnel = NgrokTlsTunnel
module.exports.NgrokLabeledTunnel = NgrokLabeledTunnel
module.exports.NgrokHttpTunnelBuilder = NgrokHttpTunnelBuilder
module.exports.NgrokTcpTunnelBuilder = NgrokTcpTunnelBuilder
module.exports.NgrokTlsTunnelBuilder = NgrokTlsTunnelBuilder
module.exports.NgrokLabeledTunnelBuilder = NgrokLabeledTunnelBuilder
//
// javascript trailer
//

const net = require('net');
const fs = require('fs');
const os = require('os');

async function defaultTunnel() {
  // set up a default session and tunnel
  var builder = new NgrokSessionBuilder();
  builder.authtokenFromEnv();
  var session = await builder.connect();
  var tunnel = await session.httpEndpoint().listen();
  tunnel.session = session; // surface to caller
  return tunnel;
}

// get a ngrok-connect socket, optionally passing in a pre-existing tunnel
async function getSocket(tunnel) {
  if (!tunnel) {
    tunnel = await defaultTunnel();
  }
  // use tcp socket with random local port
  const server = new net.Server();
  await server.listen(0);
  // forward to this socket
  tunnel.forwardTcp('localhost:' + server.address().port);
  // surface to caller
  server.tunnel = tunnel;
  return server;
}

// bind a server to a ngrok tunnel, optionally passing in a pre-existing tunnel
async function ngrokListen(server, tunnel) {
  if (!tunnel) {
    tunnel = await defaultTunnel();
  }
  // todo: abstract socket on linux: https://stackoverflow.com/a/60014174
  // todo: named pipe on windows: https://nodejs.org/api/net.html#ipc-support

  // attempt unix socket
  try {
    await ngrokLinkUnix(tunnel, server);
  } catch (err) {
    console.debug("Using TCP socket. " + err);
    // fallback to tcp socket
    await ngrokLinkTcp(tunnel, server);
  }

  server.tunnel = tunnel; // surface to caller
  return tunnel;
}

async function ngrokLinkTcp(tunnel, server) {
  // random local port
  await server.listen(0);
  // forward to socket
  tunnel.forwardTcp('localhost:' + server.address().port);
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
  await server.listen({path: filename});
  // tighten permissions
  try {
    fs.chmodSync(filename, fs.constants.S_IRWXU);
  } catch (err) {
    console.debug("Cannot change permissions of file: " + filename);
  }
  // forward tunnel
  tunnel.forwardUnix(filename);
}

module.exports.getSocket = getSocket;
module.exports.listen = ngrokListen;
