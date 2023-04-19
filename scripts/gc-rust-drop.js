// run with: node --trace-gc --expose-gc
if (typeof global.gc !== "function") {
  console.log("must run with '--expose-gc'");
  process.exit();
}

const SegfaultHandler = require("../node_modules/segfault-handler");
SegfaultHandler.registerHandler("crash.log");

const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200);
    res.write("Hello");
    res.end();
  })
  .listen(8081);

var ngrok = require("..");
// turn on debug
ngrok.consoleLog();

new ngrok.NgrokSessionBuilder()
  .authtokenFromEnv()
  .connect()
  .then((session) => {
    session
      .httpEndpoint()
      .listen()
      .then((tunnel) => {
        tunnel.forwardTcp("localhost:8081").await;
        const tun_id = tunnel.id();
        console.log("tunnel: " + tunnel.url() + " id: " + tun_id);
        console.log("\n\n=====> nulling tunnel");
        tunnel = null; // nodejs can gc

        setTimeout(function () {
          console.log("\n\n=====> running gc");
          global.gc();
        }, 2000);

        setTimeout(function () {
          console.log("\n\n=====> closing tunnel");
          session.closeTunnel(tun_id).await;
        }, 4000);

        setTimeout(function () {
          console.log("\n\n=====> nulling session, running gc");
          session = null;
          global.gc();
        }, 6000);
      });
  }).await;
