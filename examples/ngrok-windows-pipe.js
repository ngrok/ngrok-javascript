// Forwarding to a Windows named pipe (or, on other platforms, a unix domain socket) is
// not currently supported by this package's underlying ngrok-rust fork -- its `Upstream`
// dialer only ever dials plain TCP (see `resolve_upstream_addr` in ngrok-rust's
// agent.rs). A `unix:...` address is rejected up front with a clear error. A
// `\\.\pipe\...` address is not caught by that same guard and will still silently
// resolve to `localhost:80` instead of reaching your server. Point your local server at
// a TCP port and forward to `localhost:<port>` instead -- see ngrok-http-minimum.js.
