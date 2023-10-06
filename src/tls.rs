use bytes::Bytes;
use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;

use crate::listener_builder::TlsListenerBuilder;

#[napi]
#[allow(dead_code)]
impl TlsListenerBuilder {
    /// The domain to request for this edge, any valid domain or hostname that you have
    /// previously registered with ngrok. If using a custom domain, this requires
    /// registering in the [ngrok dashboard] and setting a DNS CNAME value.
    ///
    /// [ngrok dashboard]: https://dashboard.ngrok.com/cloud-edge/domains
    #[napi]
    pub fn domain(&mut self, domain: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.domain(domain);
        self
    }
    /// Certificates to use for client authentication at the ngrok edge.
    /// See [Mutual TLS] in the ngrok docs for additional details.
    ///
    /// [Mutual TLS]: https://ngrok.com/docs/cloud-edge/modules/mutual-tls/
    #[napi]
    pub fn mutual_tlsca(&mut self, mutual_tlsca: Uint8Array) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.mutual_tlsca(Bytes::from(mutual_tlsca.to_vec()));
        self
    }
    /// The key to use for TLS termination at the ngrok edge in PEM format.
    /// See [TLS Termination] in the ngrok docs for additional details.
    ///
    /// [TLS Termination]: https://ngrok.com/docs/cloud-edge/modules/tls-termination/
    #[napi]
    pub fn termination(&mut self, cert_pem: Uint8Array, key_pem: Uint8Array) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.termination(
            Bytes::from(cert_pem.to_vec()),
            Bytes::from(key_pem.to_vec()),
        );
        self
    }
}
