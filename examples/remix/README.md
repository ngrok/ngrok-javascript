# This example wires up Remix development mode

From your terminal:

```sh
npm run dev
```

This starts your app in development mode, rebuilding assets on file changes.

# Explanation

The line `require("./ngrok.config.js");` is added to `remix.config.js` which includes the code to setup the ngrok listener on the appropriate port, which defaults to `3000`.

# Example Output

```
> npm run dev

> dev
> remix dev

Forwarding to: localhost:3000 from ingress at: https://935d84664d13.ngrok.app
Remix App Server started at http://localhost:3000 (http://192.168.2.66:3000)
```

# Additional information

For more information about Remix see:

- [Remix Docs](https://remix.run/docs)
- [Remix Readme](REMIX-README.md)
