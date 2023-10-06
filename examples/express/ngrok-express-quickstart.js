const express = require("express");
const ngrok = require("@ngrok/ngrok");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

ngrok.listen(app).then(() => {
  console.log("established listener at: " + app.listener.url());
});
