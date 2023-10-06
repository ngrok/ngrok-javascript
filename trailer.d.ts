/**
 * Get a listenable ngrok listener, suitable for passing to net.Server.listen().
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate.
 */
export function listenable(): Listener;
/**
 * Start the given net.Server listening to a generated, or passed in, listener.
 * Uses the NGROK_AUTHTOKEN environment variable to authenticate if a new listener is created.
 */
export function listen(server: import("net").Server, listener?: Listener): Listener;
/**
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String): void;
