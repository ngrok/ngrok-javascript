// setup ngrok ingress
const ngrok = require('@ngrok/ngrok');
var port = '3000';
if (process.env.PORT) port = process.env.PORT;
process.argv.forEach((item, index) => { if (item == '--port') port = process.argv[index+1]; });
new ngrok.NgrokSessionBuilder().authtokenFromEnv().connect().then((session) => {
  session.httpEndpoint().listen().then((tunnel) => {
    console.log(`Forwarding to: localhost:${port} from ingress at: ${tunnel.url()}`);
    tunnel.forwardTcp(`localhost:${port}`);
  });
});

/** @type {import('@remix-run/dev').AppConfig} */
module.exports = {
  ignoredRouteFiles: ["**/.*"],
  // appDirectory: "app",
  // assetsBuildDirectory: "public/build",
  // serverBuildPath: "build/index.js",
  // publicPath: "/build/",
  future: {
    v2_errorBoundary: true,
    v2_meta: true,
    v2_normalizeFormMethod: true,
    v2_routeConvention: true,
  },
};
