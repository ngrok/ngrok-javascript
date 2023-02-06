const express = require('express')
const ngrok = require('@ngrok/ngrok')
const app = express()

app.get('/', (req, res) => {
  res.send('Hello World!')
})

ngrok.listen(app).then(() => {
  console.log("listening at: " + app.tunnel.url());
});
