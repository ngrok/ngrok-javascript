use std::{
    str::FromStr,
    sync::Arc,
};

use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    config::{
        HttpTunnelBuilder,
        LabeledTunnelBuilder,
        ProxyProto,
        TcpTunnelBuilder,
        TlsTunnelBuilder,
    },
    prelude::*,
    Session,
};
use parking_lot::Mutex;
use tracing::debug;
use url::Url;

use crate::{
    napi_err,
    napi_ngrok_err,
    tunnel::{
        NgrokHttpTunnel,
        NgrokLabeledTunnel,
        NgrokTcpTunnel,
        NgrokTlsTunnel,
        NgrokTunnel,
    },
};

macro_rules! make_tunnel_builder {
    ($(#[$outer:meta])* $wrapper:ident, $builder:tt, $tunnel:tt, $mode:tt) => {
        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            session: Arc<Mutex<Session>>,
            pub(crate) tunnel_builder: Arc<Mutex<$builder>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) fn new(session: Session, raw_tunnel_builder: $builder) -> Self {
                $wrapper {
                    session: Arc::new(Mutex::new(session)),
                    tunnel_builder: Arc::new(Mutex::new(raw_tunnel_builder)),
                }
            }

            /// Tunnel-specific opaque metadata. Viewable via the API.
            #[napi]
            pub fn metadata(&mut self, metadata: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.metadata(metadata);
                self
            }

            /// Begin listening for new connections on this tunnel.
            #[napi]
            pub async fn listen(&self, _bind: Option<bool>) -> Result<NgrokTunnel> {
                let session = self.session.lock().clone();
                let tun = self.tunnel_builder.lock().clone();
                let result = tun
                    .listen()
                    .await
                    .map_err(|e| napi_ngrok_err("failed to start tunnel", &e));

                // create the wrapping tunnel object via its async new()
                match result {
                    Ok(raw_tun) => Ok($tunnel::new_tunnel(session, raw_tun).await),
                    Err(val) => Err(val),
                }
            }

            /// Begin listening for new connections on this tunnel and forwarding them to the given url.
            #[napi]
            pub async fn listen_and_forward(&self, to_url: String) -> Result<NgrokTunnel> {
                let url = Url::parse(&to_url).map_err(|e| napi_err(format!("Url forward argument parse failure, {e}")))?;
                let session = self.session.lock().clone();
                let builder = self.tunnel_builder.lock().clone();

                let result = builder
                .listen_and_forward(url)
                .await
                .map_err(|e| napi_ngrok_err("failed to start tunnel", &e));

                // create the wrapping tunnel object via its async new()
                match result {
                    Ok(raw_fwd) => Ok($tunnel::new_forwarder(session, raw_fwd).await),
                    Err(val) => Err(val),
                }
            }

            /// Begin listening for new connections on this tunnel and forwarding them to the given server.
            #[napi(ts_args_type = "server: any")]
            pub async fn listen_and_serve(&self, server: String) -> Result<NgrokTunnel> {
                Err(napi_err(format!("listen_and_serve implemented in wrapper, {server}")))
            }
        }

        impl ObjectFinalize for $wrapper {
            fn finalize(self, mut _env: Env) -> Result<()> {
                debug!("{} finalize", stringify!($wrapper));
                Ok(())
            }
        }

        make_tunnel_builder!($mode, $wrapper);
    };

    (common, $wrapper:ty) => {
        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
            /// Call multiple times to add additional CIDR ranges.
            #[napi]
            pub fn allow_cidr(&mut self, cidr: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.allow_cidr(cidr);
                self
            }
            /// Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
            /// Call multiple times to add additional CIDR ranges.
            #[napi]
            pub fn deny_cidr(&mut self, cidr: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.deny_cidr(cidr);
                self
            }
            /// The version of PROXY protocol to use with this tunnel "1", "2", or "" if not using.
            #[napi]
            pub fn proxy_proto(&mut self, proxy_proto: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.proxy_proto(
                    ProxyProto::from_str(proxy_proto.as_str())
                        .unwrap_or_else(|_| panic!("Unknown proxy protocol: {:?}", proxy_proto)),
                );
                self
            }
            /// Tunnel backend metadata. Viewable via the dashboard and API, but has no
            /// bearing on tunnel behavior.
            #[napi]
            pub fn forwards_to(&mut self, forwards_to: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.forwards_to(forwards_to);
                self
            }
        }
    };

    (label, $wrapper:ty) => {
        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// Add a label, value pair for this tunnel.
            #[napi]
            pub fn label(&mut self, label: String, value: String) -> &Self {
                let mut builder = self.tunnel_builder.lock();
                builder.label(label, value);
                self
            }
        }
    };
}

make_tunnel_builder! {
    /// An ngrok tunnel backing an HTTP endpoint.
    ///
    /// @group Tunnel Builders
    NgrokHttpTunnelBuilder, HttpTunnelBuilder, NgrokHttpTunnel, common
}
make_tunnel_builder! {
    /// An ngrok tunnel backing a TCP endpoint.
    ///
    /// @group Tunnel Builders
    NgrokTcpTunnelBuilder, TcpTunnelBuilder, NgrokTcpTunnel, common
}
make_tunnel_builder! {
    /// An ngrok tunnel backing a TLS endpoint.
    ///
    /// @group Tunnel Builders
    NgrokTlsTunnelBuilder, TlsTunnelBuilder, NgrokTlsTunnel, common
}
make_tunnel_builder! {
    /// A labeled ngrok tunnel.
    ///
    /// @group Tunnel Builders
    NgrokLabeledTunnelBuilder, LabeledTunnelBuilder, NgrokLabeledTunnel, label
}
