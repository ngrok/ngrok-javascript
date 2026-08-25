const express = require("express");
const ngrok = require("@ngrok/ngrok");
const app = express();

app.get("/", (req, res) => {
  res.send("Hello World!");
});

ngrok.listen(app).then((endpoint) => {
  console.log("established ingress at: " + endpoint.url());
});
