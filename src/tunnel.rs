use std::{
    collections::HashMap,
    io,
    sync::Arc,
};

use async_trait::async_trait;
use lazy_static::lazy_static;
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
    Session,
};
use tokio::sync::Mutex;
use tracing::{
    debug,
    info,
};

use crate::napi_err;

lazy_static! {
    // tunnel references to be kept until explicit close to prevent nodejs gc from dropping them.
    // the tunnel wrapper object, and the underlying tunnel, both have references to the Session
    // so the Session is safe from premature dropping.
    static ref GLOBAL_TUNNELS: Mutex<HashMap<String,Arc<Mutex<dyn ExtendedTunnel>>>> = Mutex::new(HashMap::new());
}

/// The TunnelExt cannot be turned into an object since it contains generics, so implementing
/// a proxy trait without generics which can be the dyn type stored in the global map.
#[async_trait]
pub trait ExtendedTunnel: Tunnel {
    async fn fwd_tcp(&mut self, addr: String) -> core::result::Result<(), io::Error>;
    #[cfg(not(target_os = "windows"))]
    async fn fwd_unix(&mut self, addr: String) -> core::result::Result<(), io::Error>;
}

macro_rules! make_tunnel_type {
    // the common (non-labeled) branch
    ($(#[$outer:meta])* $wrapper:ident, $tunnel:tt, common) => {

        $(#[$outer])*
        #[napi(custom_finalize)]
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
            id: String,
            forwards_to: String,
            metadata: String,
            url: String,
            proto: String,
            session: Session,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new(session: Session, raw_tunnel: $tunnel) -> Self {
                let id = raw_tunnel.id().to_string();
                let forwards_to = raw_tunnel.forwards_to().to_string();
                let metadata = raw_tunnel.metadata().to_string();
                let url = raw_tunnel.url().to_string();
                let proto = raw_tunnel.proto().to_string();
                info!("Created tunnel {id:?} with url {url:?}");
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                GLOBAL_TUNNELS.lock().await.insert(id.clone(), Arc::new(Mutex::new(raw_tunnel)));
                $wrapper {
                    id,
                    forwards_to,
                    metadata,
                    url,
                    proto,
                    session,
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
            forwards_to: String,
            metadata: String,
            labels: HashMap<String,String>,
            session: Session,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new(session: Session, raw_tunnel: $tunnel) -> Self {
                let id = raw_tunnel.id().to_string();
                let forwards_to = raw_tunnel.forwards_to().to_string();
                let metadata = raw_tunnel.metadata().to_string();
                let labels = raw_tunnel.labels().clone();
                info!("Created tunnel {id:?} with labels {labels:?}");
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                GLOBAL_TUNNELS.lock().await.insert(id.clone(), Arc::new(Mutex::new(raw_tunnel)));
                $wrapper {
                    id,
                    forwards_to,
                    metadata,
                    labels,
                    session,
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
        #[async_trait]
        impl ExtendedTunnel for $tunnel {
            async fn fwd_tcp(&mut self, addr: String) -> core::result::Result<(), io::Error> {
                self.forward_tcp(addr).await
            }
            #[cfg(not(target_os = "windows"))]
            async fn fwd_unix(&mut self, addr: String) -> core::result::Result<(), io::Error> {
                self.forward_unix(addr).await
            }
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            /// Returns a tunnel's unique ID.
            #[napi]
            pub fn id(&self) -> String {
                self.id.clone()
            }

            /// Returns a human-readable string presented in the ngrok dashboard
            /// and the Tunnels API. Use the [HttpTunnelBuilder::forwards_to],
            /// [TcpTunnelBuilder::forwards_to], etc. to set this value
            /// explicitly.
            #[napi]
            pub fn forwards_to(&self) -> String {
                self.forwards_to.clone()
            }

            /// Returns the arbitrary metadata string for this tunnel.
            #[napi]
            pub fn metadata(&self) -> String {
                self.metadata.clone()
            }

            /// Forward incoming tunnel connections to the provided TCP address.
            #[napi]
            pub async fn forward_tcp(&self, addr: String) -> Result<()> {
                info!("Tunnel {:?} TCP forwarding to {addr:?}", &self.id);
                // we must clone the Arc before locking so we have a local reference
                // to the mutex to unlock if this struct is dropped.
                let arc = GLOBAL_TUNNELS.lock().await
                    .get(&self.id)
                    .ok_or(napi_err("Tunnel is no longer running"))?
                    .clone(); // required clone

                // doing this as a seperate statement so the GLOBAL_TUNNELS lock is dropped
                let res = arc
                    .lock()
                    .await
                    .fwd_tcp(addr)
                    .await
                    .map_err(|e| napi_err(format!("cannot forward tcp: {e:?}")));
                debug!("forward_tcp returning");
                res
            }

            /// Forward incoming tunnel connections to the provided Unix socket path.
            #[napi]
            pub async fn forward_unix(&self, addr: String) -> Result<()> {
                info!("Tunnel {:?} pipe forwarding to {addr:?}", &self.id);
                #[cfg(not(target_os = "windows"))]
                {
                    // we must clone the Arc before locking so we have a local reference
                    // to the mutex to unlock if this struct is dropped.
                    let arc = GLOBAL_TUNNELS.lock().await
                        .get(&self.id)
                        .ok_or(napi_err("Tunnel is no longer running"))?
                        .clone(); // required clone

                    // doing this as a seperate statement so the GLOBAL_TUNNELS lock is dropped
                    let res = arc
                        .lock()
                        .await
                        .fwd_unix(addr)
                        .await
                        .map_err(|e| napi_err(format!("cannot forward unix: {e:?}")));
                    debug!("forward_unix returning");
                    res
                }
                #[cfg(target_os = "windows")] {
                    Err(napi_err(format!("forward_unix not supported on windows")))
                }
            }

            /// Close the tunnel.
            ///
            /// This is an RPC call that must be `.await`ed.
            /// It is equivalent to calling `Session::close_tunnel` with this
            /// tunnel's ID.
            #[napi]
            pub async fn close(&self) -> Result<()> {
                debug!("{} closing, id: {}", stringify!($wrapper), self.id);

                // we may not be able to lock our reference to the tunnel due to the forward_* calls which
                // continuously accept-loop while the tunnel is active, so calling close on the Session.
                let res = self.session.close_tunnel(self.id.clone())
                    .await
                    .map_err(|e| napi_err(format!("error closing tunnel: {e:?}")));

                // drop our internal reference to the tunnel after awaiting close
                GLOBAL_TUNNELS.lock().await.remove(&self.id);

                res
            }
        }

        #[allow(unused_mut)]
        impl ObjectFinalize for $wrapper {
            fn finalize(mut self, _env: Env) -> Result<()> {
                debug!("{} finalize, id: {}", stringify!($wrapper), self.id);
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

/// Delete any reference to the tunnel id
pub(crate) async fn remove_global_tunnel(id: &String) {
    GLOBAL_TUNNELS.lock().await.remove(id);
}
