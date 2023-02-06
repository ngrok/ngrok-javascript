use std::str::FromStr;

use bytes::Bytes;
use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;
use ngrok::config::{
    OauthOptions,
    OidcOptions,
    Scheme,
};

use crate::tunnel_builder::NgrokHttpTunnelBuilder;

#[napi]
#[allow(dead_code)]
impl NgrokHttpTunnelBuilder {
    /// The scheme that this edge should use.
    /// Defaults to [Scheme::HTTPS].
    #[napi]
    pub fn scheme(&mut self, scheme: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().scheme(
            Scheme::from_str(scheme.as_str())
                .unwrap_or_else(|_| panic!("Unknown scheme: {scheme:?}")),
        );
        self
    }
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
    /// Enable gzip compression for HTTP responses.
    #[napi]
    pub fn compression(&mut self) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().compression();
        self
    }
    /// Convert incoming websocket connections to TCP-like streams.
    #[napi]
    pub fn websocket_tcp_conversion(&mut self) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().websocket_tcp_conversion();
        self
    }
    /// Reject requests when 5XX responses exceed this ratio.
    /// Disabled when 0.
    #[napi]
    pub fn circuit_breaker(&mut self, circuit_breaker: f64) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().circuit_breaker(circuit_breaker);
        self
    }

    /// with_request_header adds a header to all requests to this edge.
    #[napi]
    pub fn request_header(&mut self, name: String, value: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().request_header(name, value);
        self
    }
    /// with_response_header adds a header to all responses coming from this edge.
    #[napi]
    pub fn response_header(&mut self, name: String, value: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().response_header(name, value);
        self
    }
    /// with_remove_request_header removes a header from requests to this edge.
    #[napi]
    pub fn remove_request_header(&mut self, name: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().remove_request_header(name);
        self
    }
    /// with_remove_response_header removes a header from responses from this edge.
    #[napi]
    pub fn remove_response_header(&mut self, name: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().remove_response_header(name);
        self
    }

    /// Credentials for basic authentication.
    /// If not called, basic authentication is disabled.
    #[napi]
    pub fn basic_auth(&mut self, username: String, password: String) -> &Self {
        self.tunnel_builder = self.tunnel_builder.clone().basic_auth(username, password);
        self
    }

    /// OAuth configuration.
    /// If not called, OAuth is disabled.
    #[napi]
    pub fn oauth(
        &mut self,
        provider: String,
        allow_emails: Vec<String>,
        allow_domains: Vec<String>,
        scopes: Vec<String>,
    ) -> &Self {
        let mut oauth = OauthOptions::new(provider);
        allow_emails.iter().for_each(|v| {
            oauth = oauth.clone().allow_email(v);
        });
        allow_domains.iter().for_each(|v| {
            oauth = oauth.clone().allow_domain(v);
        });
        scopes.iter().for_each(|v| {
            oauth = oauth.clone().scope(v);
        });

        self.tunnel_builder = self.tunnel_builder.clone().oauth(oauth);
        self
    }

    /// OIDC configuration.
    /// If not called, OIDC is disabled.
    #[napi]
    pub fn oidc(
        &mut self,
        issuer_url: String,
        client_id: String,
        client_secret: String,
        allow_emails: Vec<String>,
        allow_domains: Vec<String>,
        scopes: Vec<String>,
    ) -> &Self {
        let mut oidc = OidcOptions::new(issuer_url, client_id, client_secret);
        allow_emails.iter().for_each(|v| {
            oidc = oidc.clone().allow_email(v);
        });
        allow_domains.iter().for_each(|v| {
            oidc = oidc.clone().allow_domain(v);
        });
        scopes.iter().for_each(|v| {
            oidc = oidc.clone().scope(v);
        });

        self.tunnel_builder = self.tunnel_builder.clone().oidc(oidc);
        self
    }

    /// WebhookVerification configuration.
    /// If not called, WebhookVerification is disabled.
    #[napi]
    pub fn webhook_verification(&mut self, provider: String, secret: String) -> &Self {
        self.tunnel_builder = self
            .tunnel_builder
            .clone()
            .webhook_verification(provider, secret);
        self
    }
}
