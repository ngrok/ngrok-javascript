const Koa = require("koa");
const ngrok = require("@ngrok/ngrok");
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = "Hello World";
});

ngrok.listen(app).then((endpoint) => {
  console.log(`Ingress established at: ${endpoint.url()}`);
  console.log(`Koa listening on: ${endpoint.socket.address()}`);
});
