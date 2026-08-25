/**
 * Bind `server` to a local socket, create/reuse the default agent (via NGROK_AUTHTOKEN),
 * and forward a new endpoint to it in one step. Surfaces the created endpoint as
 * `server.endpoint`/`socket.endpoint`/`endpoint.socket`.
 */
export function listen(server: import("net").Server, config?: Config): Promise<Endpoint>;
/**
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String): void;
