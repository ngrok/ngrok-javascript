const Koa = require('koa');
const app = new Koa();

app.use(async ctx => {
  ctx.body = 'Hello World';
});

var ngrok = require('@ngrok/ngrok');
ngrok.listen(app).then(() => {
  console.log("Ingress at: " + app.tunnel.url());
});
