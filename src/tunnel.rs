use std::{
    collections::HashMap,
    sync::Arc,
};

use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    prelude::*,
    tunnel::{
        HttpTunnel,
        LabeledTunnel,
        ProtoTunnel,
        TcpTunnel,
        TlsTunnel,
        UrlTunnel,
    },
};
use tokio::sync::Mutex;
use tracing::debug;

macro_rules! make_tunnel_type {
    // the common (non-labeled) branch
    ($(#[$outer:meta])* $wrapper:ident, $tunnel:tt, common) => {
        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            id: String,
            url: String,
            proto: String,
            inner: Arc<Mutex<$tunnel>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) fn new(raw_tunnel: $tunnel) -> Self {
                $wrapper {
                    id: raw_tunnel.id().to_string(),
                    url: raw_tunnel.url().to_string(),
                    proto: raw_tunnel.proto().to_string(),
                    inner: Arc::new(Mutex::new(raw_tunnel)),
                }
            }

            /// The URL that this tunnel backs.
            #[napi]
            pub fn url(&self) -> String {
                self.url.clone()
            }

            /// The protocol of the endpoint that this tunnel backs.
            #[napi]
            pub fn proto(&self) -> String {
                self.proto.clone()
            }
        }

        make_tunnel_type!($wrapper, $tunnel);
    };

    // the labeled branch
    ($(#[$outer:meta])* $wrapper:ident, $tunnel:tt, label) => {
        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            id: String,
            labels: HashMap<String,String>,
            inner: Arc<Mutex<$tunnel>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) fn new(raw_tunnel: $tunnel) -> Self {
                $wrapper {
                    id: raw_tunnel.id().to_string(),
                    labels: raw_tunnel.labels().clone(),
                    inner: Arc::new(Mutex::new(raw_tunnel)),
                }
            }

            /// The labels this tunnel was started with.
            #[napi]
            pub fn labels(&self) -> HashMap<String, String> {
                self.labels.clone()
            }
        }

        make_tunnel_type!($wrapper, $tunnel);
    };

    // all tunnels get these
    ($wrapper:ident, $tunnel:tt) => {
        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// The ID of this tunnel, assigned by the remote server.
            #[napi]
            pub fn id(&self) -> String {
                self.id.clone()
            }

            /// Forward incoming tunnel connections to the provided TCP address.
            #[napi]
            pub async fn forward_tcp(&self, addr: String) -> Result<()> {
                self.inner
                    .lock()
                    .await
                    .forward_tcp(addr)
                    .await
                    .map_err(|e| Error::new(Status::GenericFailure, format!("cannot forward tcp: {e:?}")))
            }

            /// Forward incoming tunnel connections to the provided Unix socket path.
            #[napi]
            pub async fn forward_unix(&self, addr: String) -> Result<()> {
                #[cfg(not(target_os = "windows"))]
                {
                    self.inner
                        .lock()
                        .await
                        .forward_unix(addr)
                        .await
                        .map_err(|e| Error::new(Status::GenericFailure, format!("cannot forward unix: {e:?}")))
                }
                #[cfg(target_os = "windows")] {
                    Err(Error::new(Status::GenericFailure, format!("forward_unix not supported on windows")))
                }
            }
        }

        impl ObjectFinalize for $wrapper {
            fn finalize(self, mut _env: Env) -> Result<()> {
                debug!("$wrapper finalize");
                Ok(())
            }
        }
    };
}

make_tunnel_type! {
    /// An ngrok tunnel backing an HTTP endpoint.
    NgrokHttpTunnel, HttpTunnel, common
}
make_tunnel_type! {
    /// An ngrok tunnel backing a TCP endpoint.
    NgrokTcpTunnel, TcpTunnel, common
}
make_tunnel_type! {
    /// An ngrok tunnel bcking a TLS endpoint.
    NgrokTlsTunnel, TlsTunnel, common
}
make_tunnel_type! {
    /// A labeled ngrok tunnel.
    NgrokLabeledTunnel, LabeledTunnel, label
}
