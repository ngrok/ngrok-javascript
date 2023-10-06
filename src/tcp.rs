use napi_derive::napi;

use crate::listener_builder::TcpListenerBuilder;

#[napi]
#[allow(dead_code)]
impl TcpListenerBuilder {
    /// The TCP address to request for this edge.
    /// These addresses can be reserved in the [ngrok dashboard] to use across sessions. For example: remote_addr("2.tcp.ngrok.io:21746")
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/tcp-addresses
    #[napi]
    pub fn remote_addr(&mut self, remote_addr: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.remote_addr(remote_addr);
        self
    }
}
