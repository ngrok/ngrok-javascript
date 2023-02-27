export function getSocket(tunnel?: (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)): net.Server
export function listen(server: net.Server, tunnel?: (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)): (NgrokHttpTunnel|NgrokTcpTunnel|NgrokTlsTunnel|NgrokLabeledTunnel)
export function consoleLog(level?: String)
