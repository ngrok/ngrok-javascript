/**
 * Get a listenable ngrok tunnel, suitable for passing to net.Server.listen().
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate.
 */
export function listenable(): NgrokTunnel;
/**
 * Start the given net.Server listening to a generated, or passed in, tunnel.
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new tunnel is created.
 */
export function listen(server: import("net").Server, tunnel?: NgrokTunnel): NgrokTunnel;
/**
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String): void;
