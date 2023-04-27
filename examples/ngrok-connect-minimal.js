// make webserver
const http = require("http");
http
  .createServer(function (req, res) {
    res.writeHead(200, { "Content-Type": "text/html" });
    res.write("Congrats you have a created an ngrok web server");
    res.end();
  })
  .listen(8080);
console.log(`Node.js web server at 8080 is running..`);

// setup ngrok
const ngrok = require("@ngrok/ngrok");
ngrok.connect({ addr: 8080, authtoken_from_env: true }).then((url) => {
  console.log(`Ingress established at: ${url}`);
});
