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
    listener::{
        HttpListener,
        LabeledListener,
        Listener,
        TcpListener,
        TlsListener,
    },
    napi_err,
    napi_ngrok_err,
};

macro_rules! make_listener_builder {
    ($(#[$outer:meta])* $wrapper:ident, $builder:tt, $listener:tt, $mode:tt) => {
        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            session: Arc<Mutex<Session>>,
            pub(crate) listener_builder: Arc<Mutex<$builder>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) fn new(session: Session, raw_listener_builder: $builder) -> Self {
                $wrapper {
                    session: Arc::new(Mutex::new(session)),
                    listener_builder: Arc::new(Mutex::new(raw_listener_builder)),
                }
            }

            /// Listener-specific opaque metadata. Viewable via the API.
            #[napi]
            pub fn metadata(&mut self, metadata: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.metadata(metadata);
                self
            }

            /// Begin listening for new connections on this listener.
            #[napi]
            pub async fn listen(&self, _bind: Option<bool>) -> Result<Listener> {
                let session = self.session.lock().clone();
                let tun = self.listener_builder.lock().clone();
                let result = tun
                    .listen()
                    .await
                    .map_err(|e| napi_ngrok_err("failed to start listener", &e));

                // create the wrapping listener object via its async new()
                match result {
                    Ok(raw_tun) => Ok($listener::new_listener(session, raw_tun).await),
                    Err(val) => Err(val),
                }
            }

            /// Begin listening for new connections on this listener and forwarding them to the given url.
            #[napi]
            pub async fn listen_and_forward(&self, to_url: String) -> Result<Listener> {
                let url = Url::parse(&to_url).map_err(|e| napi_err(format!("Url forward argument parse failure, {e}")))?;
                let session = self.session.lock().clone();
                let builder = self.listener_builder.lock().clone();

                let result = builder
                .listen_and_forward(url)
                .await
                .map_err(|e| napi_ngrok_err("failed to start listener", &e));

                // create the wrapping listener object via its async new()
                match result {
                    Ok(raw_fwd) => Ok($listener::new_forwarder(session, raw_fwd).await),
                    Err(val) => Err(val),
                }
            }

            /// Begin listening for new connections on this listener and forwarding them to the given server.
            #[napi(ts_args_type = "server: any")]
            pub async fn listen_and_serve(&self, server: String) -> Result<Listener> {
                Err(napi_err(format!("listen_and_serve implemented in wrapper, {server}")))
            }
        }

        impl ObjectFinalize for $wrapper {
            fn finalize(self, mut _env: Env) -> Result<()> {
                debug!("{} finalize", stringify!($wrapper));
                Ok(())
            }
        }

        make_listener_builder!($mode, $wrapper);
    };

    (common, $wrapper:ty) => {
        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// Restriction placed on the origin of incoming connections to the edge to only allow these CIDR ranges.
            /// Call multiple times to add additional CIDR ranges.
            /// See [IP restrictions] in the ngrok docs for additional details.
            ///
            /// [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
            #[napi]
            pub fn allow_cidr(&mut self, cidr: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.allow_cidr(cidr);
                self
            }
            /// Restriction placed on the origin of incoming connections to the edge to deny these CIDR ranges.
            /// Call multiple times to add additional CIDR ranges.
            /// See [IP restrictions] in the ngrok docs for additional details.
            ///
            /// [IP restrictions]: https://ngrok.com/docs/cloud-edge/modules/ip-restrictions/
            #[napi]
            pub fn deny_cidr(&mut self, cidr: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.deny_cidr(cidr);
                self
            }
            /// The version of PROXY protocol to use with this listener "1", "2", or "" if not using.
            #[napi]
            pub fn proxy_proto(&mut self, proxy_proto: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.proxy_proto(
                    ProxyProto::from_str(proxy_proto.as_str())
                        .unwrap_or_else(|_| panic!("Unknown proxy protocol: {:?}", proxy_proto)),
                );
                self
            }
            /// Listener backend metadata. Viewable via the dashboard and API, but has no
            /// bearing on listener behavior.
            #[napi]
            pub fn forwards_to(&mut self, forwards_to: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.forwards_to(forwards_to);
                self
            }
        }
    };

    (label, $wrapper:ty) => {
        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// Add a label, value pair for this listener.
            /// See [Using Labels] in the ngrok docs for additional details.
            ///
            /// [Using Labels]: https://ngrok.com/docs/guides/using-labels-within-ngrok/
            #[napi]
            pub fn label(&mut self, label: String, value: String) -> &Self {
                let mut builder = self.listener_builder.lock();
                builder.label(label, value);
                self
            }
        }
    };
}

make_listener_builder! {
    /// An ngrok listener backing an HTTP endpoint.
    ///
    /// @group Listener Builders
    HttpListenerBuilder, HttpTunnelBuilder, HttpListener, common
}
make_listener_builder! {
    /// An ngrok listener backing a TCP endpoint.
    ///
    /// @group Listener Builders
    TcpListenerBuilder, TcpTunnelBuilder, TcpListener, common
}
make_listener_builder! {
    /// An ngrok listener backing a TLS endpoint.
    ///
    /// @group Listener Builders
    TlsListenerBuilder, TlsTunnelBuilder, TlsListener, common
}
make_listener_builder! {
    /// A labeled ngrok listener.
    ///
    /// @group Listener Builders
    LabeledListenerBuilder, LabeledTunnelBuilder, LabeledListener, label
}
