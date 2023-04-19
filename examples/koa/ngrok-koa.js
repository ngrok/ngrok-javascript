const Koa = require("koa");
const ngrok = require("@ngrok/ngrok");
const app = new Koa();

app.use(async (ctx) => {
  ctx.body = "Hello World";
});

ngrok.listen(app).then((socket) => {
  console.log(`Ingress established at: ${app.tunnel.url()}`);
  console.log(`Koa listening on: ${socket.address()}`);
});
