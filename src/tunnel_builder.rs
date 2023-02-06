use std::str::FromStr;

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
};
use tracing::debug;

use crate::tunnel::{
    NgrokHttpTunnel,
    NgrokLabeledTunnel,
    NgrokTcpTunnel,
    NgrokTlsTunnel,
};

macro_rules! make_tunnel_builder {
    ($(#[$outer:meta])* $wrapper:ident, $builder:tt, $tunnel:tt, $mode:tt) => {
        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            pub(crate) tunnel_builder: $builder,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) fn new(raw_tunnel_builder: $builder) -> Self {
                $wrapper {
                    tunnel_builder: raw_tunnel_builder,
                }
            }

            /// Tunnel-specific opaque metadata. Viewable via the API.
            #[napi]
            pub fn metadata(&mut self, metadata: String) -> &Self {
                self.tunnel_builder = self.tunnel_builder.clone().metadata(metadata);
                self
            }

            /// Begin listening for new connections on this tunnel.
            #[napi]
            pub async fn listen(&self) -> Result<$tunnel> {
                self.tunnel_builder
                    .listen()
                    .await
                    .map($tunnel::new)
                    .map_err(|e| {
                        Error::new(
                            Status::GenericFailure,
                            format!("failed to start tunnel: {e:?}")
                        )
                    })
            }
        }

        impl ObjectFinalize for $wrapper {
            fn finalize(self, mut _env: Env) -> Result<()> {
                debug!("$wrapper finalize");
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
            pub fn allow_cidr_string(&mut self, cidr: String) -> &Self {
                self.tunnel_builder = self.tunnel_builder.clone().allow_cidr_string(cidr);
                self
            }
            /// Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
            /// Call multiple times to add additional CIDR ranges.
            #[napi]
            pub fn deny_cidr_string(&mut self, cidr: String) -> &Self {
                self.tunnel_builder = self.tunnel_builder.clone().deny_cidr_string(cidr);
                self
            }
            /// The version of PROXY protocol to use with this tunnel, None if not using.
            #[napi]
            pub fn proxy_proto(&mut self, proxy_proto: String) -> &Self {
                self.tunnel_builder = self.tunnel_builder.clone().proxy_proto(
                    ProxyProto::from_str(proxy_proto.as_str())
                        .unwrap_or_else(|_| panic!("Unknown proxy protocol: {:?}", proxy_proto)),
                );
                self
            }
            /// Tunnel backend metadata. Viewable via the dashboard and API, but has no
            /// bearing on tunnel behavior.
            #[napi]
            pub fn forwards_to(&mut self, forwards_to: String) -> &Self {
                self.tunnel_builder = self.tunnel_builder.clone().forwards_to(forwards_to);
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
                self.tunnel_builder = self.tunnel_builder.clone().label(label, value);
                self
            }
        }
    };
}

make_tunnel_builder! {
    /// An ngrok tunnel backing an HTTP endpoint.
    NgrokHttpTunnelBuilder, HttpTunnelBuilder, NgrokHttpTunnel, common
}
make_tunnel_builder! {
    /// An ngrok tunnel backing a TCP endpoint.
    NgrokTcpTunnelBuilder, TcpTunnelBuilder, NgrokTcpTunnel, common
}
make_tunnel_builder! {
    /// An ngrok tunnel backing a TLS endpoint.
    NgrokTlsTunnelBuilder, TlsTunnelBuilder, NgrokTlsTunnel, common
}
make_tunnel_builder! {
    /// A labeled ngrok tunnel.
    NgrokLabeledTunnelBuilder, LabeledTunnelBuilder, NgrokLabeledTunnel, label
}
