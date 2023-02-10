use bytes::Bytes;
use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;

use crate::tunnel_builder::NgrokTlsTunnelBuilder;

#[napi]
#[allow(dead_code)]
impl NgrokTlsTunnelBuilder {
    /// The domain to request for this edge.
    #[napi]
    pub fn domain(&mut self, domain: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().domain(domain);
        self
    }
    /// Certificates to use for client authentication at the ngrok edge.
    #[napi]
    pub fn mutual_tlsca(&mut self, mutual_tlsca: Uint8Array) -> &Self {
        self.tunnel_builder = self
            .tunnel_builder
            .clone()
            .mutual_tlsca(Bytes::from(mutual_tlsca.to_vec()));
        self
    }
    /// The key to use for TLS termination at the ngrok edge in PEM format.
    #[napi]
    pub fn termination(&mut self, cert_pem: Uint8Array, key_pem: Uint8Array) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().termination(
            Bytes::from(cert_pem.to_vec()),
            Bytes::from(key_pem.to_vec()),
        );
        self
    }
}
