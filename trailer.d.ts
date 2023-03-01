/** Generate, or convert a given tunnel, into one that can be passed into net.Server.listen(). */
export function listenable(tunnel?: (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)): (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)
/** Start the given net.Server listening to a generated, or passed in, tunnel. */
export function listen(server: net.Server, tunnel?: (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)): (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)
/** 
 * Register a console.log callback for ngrok INFO logging.
 * Optionally set the logging level to one of ERROR, WARN, INFO, DEBUG, or TRACE.
 */
export function consoleLog(level?: String)
