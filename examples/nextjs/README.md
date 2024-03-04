# To Run

`node_modules/.bin/next`

# Explanation

The line `require("./ngrok.config.js");` is added to `next.config.js` which includes the code to setup the ngrok listener on the appropriate port, which defaults to `3000`.

# Example Output

```
> node_modules/.bin/next
ready - started server on 0.0.0.0:3000, url: http://localhost:3000
warn  - Detected next.config.js, no exported configuration found. https://nextjs.org/docs/messages/empty-configuration
event - compiled client and server successfully in 210 ms (154 modules)
Forwarding to: localhost:3000 from ingress at: https://04d4d919d236.ngrok.app
```
