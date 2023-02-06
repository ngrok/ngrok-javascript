use napi_derive::napi;

use crate::tunnel_builder::NgrokTcpTunnelBuilder;

#[napi]
#[allow(dead_code)]
impl NgrokTcpTunnelBuilder {
    /// The TCP address to request for this edge.
    #[napi]
    pub fn remote_addr(&mut self, remote_addr: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().remote_addr(remote_addr);
        self
    }
}
