use std::str::FromStr;

use bytes::Bytes;
use napi::bindgen_prelude::Uint8Array;
use napi_derive::napi;
use ngrok::config::{
    OauthOptions,
    OidcOptions,
    Scheme,
};

use crate::listener_builder::HttpListenerBuilder;

#[napi]
#[allow(dead_code)]
impl HttpListenerBuilder {
    /// The scheme that this edge should use.
    /// "HTTPS" or "HTTP", defaults to "HTTPS".
    #[napi]
    pub fn scheme(&mut self, scheme: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.scheme(
            Scheme::from_str(scheme.as_str())
                .unwrap_or_else(|_| panic!("Unknown scheme: {scheme:?}")),
        );
        self
    }
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
    /// Enable gzip compression for HTTP responses.
    /// See [Compression] in the ngrok docs for additional details.
    ///
    /// [Compression]: https://ngrok.com/docs/cloud-edge/modules/compression/
    #[napi]
    pub fn compression(&mut self) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.compression();
        self
    }
    /// Convert incoming websocket connections to TCP-like streams.
    #[napi]
    pub fn websocket_tcp_conversion(&mut self) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.websocket_tcp_conversion();
        self
    }
    /// Reject requests when 5XX responses exceed this ratio.
    /// Disabled when 0.
    /// See [Circuit Breaker] in the ngrok docs for additional details.
    ///
    /// [Circuit Breaker]: https://ngrok.com/docs/cloud-edge/modules/circuit-breaker/
    #[napi]
    pub fn circuit_breaker(&mut self, circuit_breaker: f64) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.circuit_breaker(circuit_breaker);
        self
    }

    /// Adds a header to all requests to this edge.
    /// See [Request Headers] in the ngrok docs for additional details.
    ///
    /// [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
    #[napi]
    pub fn request_header(&mut self, name: String, value: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.request_header(name, value);
        self
    }
    /// Adds a header to all responses coming from this edge.
    /// See [Response Headers] in the ngrok docs for additional details.
    ///
    /// [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
    #[napi]
    pub fn response_header(&mut self, name: String, value: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.response_header(name, value);
        self
    }
    /// Removes a header from requests to this edge.
    /// See [Request Headers] in the ngrok docs for additional details.
    ///
    /// [Request Headers]: https://ngrok.com/docs/cloud-edge/modules/request-headers/
    #[napi]
    pub fn remove_request_header(&mut self, name: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.remove_request_header(name);
        self
    }
    /// Removes a header from responses from this edge.
    /// See [Response Headers] in the ngrok docs for additional details.
    ///
    /// [Response Headers]: https://ngrok.com/docs/cloud-edge/modules/response-headers/
    #[napi]
    pub fn remove_response_header(&mut self, name: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.remove_response_header(name);
        self
    }

    /// Credentials for basic authentication.
    /// If not called, basic authentication is disabled.
    #[napi]
    pub fn basic_auth(&mut self, username: String, password: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.basic_auth(username, password);
        self
    }

    /// A set of regular expressions used to match User-Agents that will be allowed.
    /// On request, the User Agent Filter module will check the incoming User-Agent header value
    /// against the list of defined allow and deny regular expression rules.
    /// See [User Agent Filter] in the ngrok docs for additional details.
    ///
    /// .. [User Agent Filter]: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
    #[napi]
    pub fn allow_user_agent(&mut self, regex: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.allow_user_agent(regex);
        self
    }
    /// A set of regular expressions used to match User-Agents that will be denied.
    /// On request, the User Agent Filter module will check the incoming User-Agent header value
    /// against the list of defined allow and deny regular expression rules.
    /// See [User Agent Filter] in the ngrok docs for additional details.
    ///
    /// .. [User Agent Filter]: https://ngrok.com/docs/cloud-edge/modules/user-agent-filter/
    #[napi]
    pub fn deny_user_agent(&mut self, regex: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.deny_user_agent(regex);
        self
    }

    /// OAuth configuration.
    /// If not called, OAuth is disabled.
    /// See [OAuth] in the ngrok docs for additional details.
    ///
    /// [OAuth]: https://ngrok.com/docs/cloud-edge/modules/oauth/
    #[napi]
    pub fn oauth(
        &mut self,
        provider: String,
        allow_emails: Option<Vec<String>>,
        allow_domains: Option<Vec<String>>,
        scopes: Option<Vec<String>>,
        client_id: Option<String>,
        client_secret: Option<String>,
    ) -> &Self {
        let mut oauth = OauthOptions::new(provider);
        if let Some(allow_emails) = allow_emails {
            allow_emails.iter().for_each(|v| {
                oauth.allow_email(v);
            });
        }
        if let Some(allow_domains) = allow_domains {
            allow_domains.iter().for_each(|v| {
                oauth.allow_domain(v);
            });
        }
        if let Some(scopes) = scopes {
            scopes.iter().for_each(|v| {
                oauth.scope(v);
            });
        }
        if let Some(client_id) = client_id {
            oauth.client_id(client_id);
        }
        if let Some(client_secret) = client_secret {
            oauth.client_secret(client_secret);
        }

        let mut builder = self.listener_builder.lock();
        builder.oauth(oauth);
        self
    }

    /// OIDC configuration.
    /// If not called, OIDC is disabled.
    /// See [OpenID Connect] in the ngrok docs for additional details.
    ///
    /// [OpenID Connect]: https://ngrok.com/docs/cloud-edge/modules/openid-connect/
    #[napi]
    pub fn oidc(
        &mut self,
        issuer_url: String,
        client_id: String,
        client_secret: String,
        allow_emails: Option<Vec<String>>,
        allow_domains: Option<Vec<String>>,
        scopes: Option<Vec<String>>,
    ) -> &Self {
        let mut oidc = OidcOptions::new(issuer_url, client_id, client_secret);
        if let Some(allow_emails) = allow_emails {
            allow_emails.iter().for_each(|v| {
                oidc.allow_email(v);
            });
        }
        if let Some(allow_domains) = allow_domains {
            allow_domains.iter().for_each(|v| {
                oidc.allow_domain(v);
            });
        }
        if let Some(scopes) = scopes {
            scopes.iter().for_each(|v| {
                oidc.scope(v);
            });
        }

        let mut builder = self.listener_builder.lock();
        builder.oidc(oidc);
        self
    }

    /// WebhookVerification configuration.
    /// If not called, WebhookVerification is disabled.
    /// See [Webhook Verification] in the ngrok docs for additional details.
    ///
    /// [Webhook Verification]: https://ngrok.com/docs/cloud-edge/modules/webhook-verification/
    #[napi]
    pub fn webhook_verification(&mut self, provider: String, secret: String) -> &Self {
        let mut builder = self.listener_builder.lock();
        builder.webhook_verification(provider, secret);
        self
    }
}
