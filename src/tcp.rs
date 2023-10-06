use napi_derive::napi;

use crate::tunnel_builder::NgrokTcpTunnelBuilder;

#[napi]
#[allow(dead_code)]
impl NgrokTcpTunnelBuilder {
    /// The TCP address to request for this edge.
    /// These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
    #[napi]
    pub fn remote_addr(&mut self, remote_addr: String) -> &Self {
        let mut builder = self.tunnel_builder.lock();
        builder.remote_addr(remote_addr);
        self
    }
}
