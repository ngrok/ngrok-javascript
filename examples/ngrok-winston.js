// create winston logger
const { createLogger, format, transports } = require("winston");
const logger = createLogger({
  format: format.combine(format.timestamp(), format.json()),
  level: "silly",
  transports: [new transports.Console({})],
});

// plumb ngrok logging to winston
const ngrok = require("@ngrok/ngrok");
ngrok.loggingCallback(function (level, target, message) {
  level = level == "TRACE" ? "silly" : level.toLowerCase();
  logger.log(level, message, { target: target });
}, "TRACE");

// set up endpoint
const server = require("http").createServer(function (req, res) {
  res.writeHead(200);
  res.write("Hello");
  res.end();
});
ngrok.listen(server).then((endpoint) => {
  logger.info("Ingress established at:", endpoint.url());
});
