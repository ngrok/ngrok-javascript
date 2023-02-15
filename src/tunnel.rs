use std::{
    collections::HashMap,
    sync::Arc,
};

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
use tracing::debug;

use crate::napi_err;

lazy_static! {
    // tunnel references to be kept until explicit close to prevent nodejs gc from dropping them.
    // the tunnel wrapper object, and the underlying tunnel, both have references to the Session
    // so the Session is safe from premature dropping.
    static ref GLOBAL_TUNNELS: Mutex<HashMap<String,Arc<Mutex<dyn Tunnel>>>> = Mutex::new(HashMap::new());
}

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
            session: Session,
            inner: Option<Arc<Mutex<$tunnel>>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new(session: Session, raw_tunnel: $tunnel) -> Self {
                let id = raw_tunnel.id().to_string();
                let url = raw_tunnel.url().to_string();
                let proto = raw_tunnel.proto().to_string();
                let arc = Arc::new(Mutex::new(raw_tunnel));
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                GLOBAL_TUNNELS.lock().await.insert(id.clone(), arc.clone());
                $wrapper {
                    id,
                    url,
                    proto,
                    session,
                    inner: Some(arc),
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
            session: Session,
            inner: Option<Arc<Mutex<$tunnel>>>,
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new(session: Session, raw_tunnel: $tunnel) -> Self {
                let id = raw_tunnel.id().to_string();
                let labels = raw_tunnel.labels().clone();
                let arc = Arc::new(Mutex::new(raw_tunnel));
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                GLOBAL_TUNNELS.lock().await.insert(id.clone(), arc.clone());
                $wrapper {
                    id,
                    labels,
                    session,
                    inner: Some(arc),
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
                // we must clone the Arc before locking so we have a local reference
                // to the mutex to unlock if this struct is dropped.
                let res = self.inner.as_ref()
                    .ok_or(napi_err("Tunnel is no longer running"))?
                    .clone() // required clone
                    .lock()
                    .await
                    .forward_tcp(addr)
                    .await
                    .map_err(|e| napi_err(format!("cannot forward tcp: {e:?}")));
                debug!("forward_tcp returning");
                res
            }

            /// Forward incoming tunnel connections to the provided Unix socket path.
            #[napi]
            pub async fn forward_unix(&self, addr: String) -> Result<()> {
                #[cfg(not(target_os = "windows"))]
                {
                    // we must clone the Arc before locking so we have a local reference
                    // to the mutex to unlock if this struct is dropped.
                    let res = self.inner.as_ref()
                        .ok_or(napi_err("Tunnel is no longer running"))?
                        .clone() // required clone
                        .lock()
                        .await
                        .forward_unix(addr)
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
            #[napi]
            pub async fn close(&self) -> Result<()> {
                debug!("{} closing, id: {}", stringify!($wrapper), self.id);
                // drop our internal reference to the tunnel, giving drop control of the tunnel back to the nodejs.
                GLOBAL_TUNNELS.lock().await.remove(&self.id);

                // we may not be able to lock our reference to the tunnel due to the forward_* calls which
                // continuously accept-loop while the tunnel is active, so calling close on the Session.
                self.session.close_tunnel(self.id.clone())
                    .await
                    .map_err(|e| napi_err(format!("error closing tunnel: {e:?}")))
            }
        }

        impl ObjectFinalize for $wrapper {
            fn finalize(mut self, env: Env) -> Result<()> {
                debug!("{} finalize, id: {}", stringify!($wrapper), self.id);
                // take control of inner Tunnel, removing the reference from this evaporating object
                let inner = self.inner.take();

                // send inner Tunnel into a tokio spawn to be dropped, as dropping spawns a tokio task but
                // there is no tokio context here.
                env.spawn_future(
                    async move {
                        debug!("{} dropping tunnel reference, id: {}", stringify!($wrapper), self.id);
                        drop(inner);
                        Ok(())
                    })
                .map(|_| ())
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
