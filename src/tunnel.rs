use core::result::Result as CoreResult;
use std::{
    collections::HashMap,
    error::Error,
    io,
    sync::Arc,
};

use async_trait::async_trait;
use lazy_static::lazy_static;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    prelude::*,
    session::ConnectError,
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

use crate::{
    connect::PIPE_PREFIX,
    napi_err,
    napi_ngrok_err,
};

pub(crate) const UNIX_PREFIX: &str = "unix:";

lazy_static! {
    // tunnel references to be kept until explicit close to prevent nodejs gc from dropping them.
    // the tunnel wrapper object, and the underlying tunnel, both have references to the Session
    // so the Session is safe from premature dropping.
    static ref GLOBAL_TUNNELS: Mutex<HashMap<String,Arc<Storage>>> = Mutex::new(HashMap::new());
}

/// Stores the tunnel and session references to be kept until explicit close.
struct Storage {
    tunnel: Arc<Mutex<dyn ExtendedTunnel>>,
    session: Session,
    tun_meta: Arc<TunnelMetadata>,
}

struct TunnelMetadata {
    id: String,
    forwards_to: String,
    metadata: String,
    url: Option<String>,
    proto: Option<String>,
    labels: HashMap<String, String>,
}

/// The TunnelExt cannot be turned into an object since it contains generics, so implementing
/// a proxy trait without generics which can be the dyn type stored in the global map.
#[async_trait]
pub trait ExtendedTunnel: Tunnel {
    async fn fwd_tcp(&mut self, addr: String) -> CoreResult<(), io::Error>;
    async fn fwd_pipe(&mut self, addr: String) -> CoreResult<(), io::Error>;
}

/// An ngrok tunnel.
///
/// @group Tunnel and Sessions
#[napi(custom_finalize)]
#[allow(dead_code)]
pub struct NgrokTunnel {
    session: Session,
    tun_meta: Arc<TunnelMetadata>,
}

macro_rules! make_tunnel_type {
    // the common (non-labeled) branch
    ($(#[$outer:meta])* $wrapper:ident, $tunnel:tt, common) => {
        $(#[$outer])*
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new_tunnel(session: Session, raw_tunnel: $tunnel) -> NgrokTunnel {
                let id = raw_tunnel.id().to_string();
                let tun_meta = Arc::new(TunnelMetadata {
                    id: id.clone(),
                    forwards_to: raw_tunnel.forwards_to().to_string(),
                    metadata: raw_tunnel.metadata().to_string(),
                    url: Some(raw_tunnel.url().to_string()),
                    proto: Some(raw_tunnel.proto().to_string()),
                    labels: HashMap::new(),
                });
                info!("Created tunnel {id:?} with url {:?}", raw_tunnel.url());
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                let storage = Arc::new(Storage {
                    tunnel: Arc::new(Mutex::new(raw_tunnel)),
                    session,
                    tun_meta,
                });
                GLOBAL_TUNNELS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                NgrokTunnel::from_storage(&storage)
            }
        }

        make_tunnel_type!($wrapper, $tunnel);
    };

    // the labeled branch
    ($(#[$outer:meta])* $wrapper:ident, $tunnel:tt, label) => {
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new_tunnel(session: Session, raw_tunnel: $tunnel) -> NgrokTunnel {
                let id = raw_tunnel.id().to_string();
                let tun_meta = Arc::new(TunnelMetadata {
                    id: id.clone(),
                    forwards_to: raw_tunnel.forwards_to().to_string(),
                    metadata: raw_tunnel.metadata().to_string(),
                    url: None,
                    proto: None,
                    labels: raw_tunnel.labels().clone(),
                });
                info!("Created tunnel {id:?} with labels {:?}", tun_meta.labels);
                // keep a tunnel reference until an explicit call to close to prevent nodejs gc dropping it
                let storage = Arc::new(Storage {
                    tunnel: Arc::new(Mutex::new(raw_tunnel)),
                    session,
                    tun_meta,
                });
                GLOBAL_TUNNELS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                NgrokTunnel::from_storage(&storage)
            }
        }

        make_tunnel_type!($wrapper, $tunnel);
    };

    // all tunnels get these
    ($wrapper:ident, $tunnel:tt) => {
        #[async_trait]
        impl ExtendedTunnel for $tunnel {
            async fn fwd_tcp(&mut self, addr: String) -> CoreResult<(), io::Error> {
                self.forward_tcp(addr).await
            }
            async fn fwd_pipe(&mut self, addr: String) -> CoreResult<(), io::Error> {
                self.forward_pipe(addr).await
            }
        }
    };
}

#[napi]
#[allow(dead_code)]
impl NgrokTunnel {
    /// Create NgrokTunnel from Storage
    fn from_storage(storage: &Arc<Storage>) -> NgrokTunnel {
        // create the user-facing object
        NgrokTunnel {
            session: storage.session.clone(),
            tun_meta: storage.tun_meta.clone(),
        }
    }

    /// The URL that this tunnel backs.
    #[napi]
    pub fn url(&self) -> Option<String> {
        self.tun_meta.url.clone()
    }

    /// The protocol of the endpoint that this tunnel backs.
    #[napi]
    pub fn proto(&self) -> Option<String> {
        self.tun_meta.proto.clone()
    }

    /// The labels this tunnel was started with.
    #[napi]
    pub fn labels(&self) -> HashMap<String, String> {
        self.tun_meta.labels.clone()
    }

    /// Returns a tunnel's unique ID.
    #[napi]
    pub fn id(&self) -> String {
        self.tun_meta.id.clone()
    }

    /// Returns a human-readable string presented in the ngrok dashboard
    /// and the Tunnels API. Use the [HttpTunnelBuilder::forwards_to],
    /// [TcpTunnelBuilder::forwards_to], etc. to set this value
    /// explicitly.
    #[napi]
    pub fn forwards_to(&self) -> String {
        self.tun_meta.forwards_to.clone()
    }

    /// Returns the arbitrary metadata string for this tunnel.
    #[napi]
    pub fn metadata(&self) -> String {
        self.tun_meta.metadata.clone()
    }

    /// Forward incoming tunnel connections. This can be either a TCP address or a file socket path.
    /// For file socket paths on Linux/Darwin, addr can be a unix domain socket path, e.g. "/tmp/ngrok.sock"
    ///     On Windows, addr can be a named pipe, e.e. "\\\\.\\pipe\\an_ngrok_pipe
    #[napi]
    pub async fn forward(&self, addr: String) -> Result<()> {
        forward(&self.tun_meta.id, addr).await
    }

    /// Close the tunnel.
    ///
    /// This is an RPC call that must be `.await`ed.
    /// It is equivalent to calling `Session::close_tunnel` with this
    /// tunnel's ID.
    #[napi]
    pub async fn close(&self) -> Result<()> {
        debug!("NgrokTunnel closing, id: {}", self.tun_meta.id);

        // we may not be able to lock our reference to the tunnel due to the forward_* calls which
        // continuously accept-loop while the tunnel is active, so calling close on the Session.
        let res = self
            .session
            .close_tunnel(self.tun_meta.id.clone())
            .await
            .map_err(|e| napi_ngrok_err("error closing tunnel", &e));

        // drop our internal reference to the tunnel after awaiting close
        GLOBAL_TUNNELS.lock().await.remove(&self.tun_meta.id);

        res
    }
}

#[allow(unused_mut)]
impl ObjectFinalize for NgrokTunnel {
    fn finalize(mut self, _env: Env) -> Result<()> {
        debug!("NgrokTunnel finalize, id: {}", self.tun_meta.id);
        Ok(())
    }
}

make_tunnel_type! {
    /// An ngrok tunnel backing an HTTP endpoint.
    ///
    /// @group Tunnels
    NgrokHttpTunnel, HttpTunnel, common
}
make_tunnel_type! {
    /// An ngrok tunnel backing a TCP endpoint.
    ///
    /// @group Tunnels
    NgrokTcpTunnel, TcpTunnel, common
}
make_tunnel_type! {
    /// An ngrok tunnel bcking a TLS endpoint.
    ///
    /// @group Tunnels
    NgrokTlsTunnel, TlsTunnel, common
}
make_tunnel_type! {
    /// A labeled ngrok tunnel.
    ///
    /// @group Tunnels
    NgrokLabeledTunnel, LabeledTunnel, label
}

pub async fn forward(id: &String, addr: String) -> Result<()> {
    let tun = &get_storage_by_id(id).await?.tunnel;
    let is_pipe =
        addr.starts_with(PIPE_PREFIX) || addr.starts_with(UNIX_PREFIX) || addr.contains('/');

    let res = if is_pipe {
        let mut tun_addr: &str = addr.as_str();
        // remove the "pipe:" and "unix:" prefix
        tun_addr = tun_addr.strip_prefix(PIPE_PREFIX).unwrap_or(tun_addr);
        tun_addr = tun_addr.strip_prefix(UNIX_PREFIX).unwrap_or(tun_addr);

        info!("Tunnel {id:?} Pipe forwarding to {tun_addr:?}");
        tun.lock().await.fwd_pipe(tun_addr.to_string()).await
    } else {
        info!("Tunnel {id:?} TCP forwarding to {addr:?}");
        tun.lock().await.fwd_tcp(addr).await
    };

    debug!("forward returning");
    canceled_is_ok(res)
}

fn canceled_is_ok(input: CoreResult<(), io::Error>) -> Result<()> {
    match input {
        Ok(_) => Ok(()),
        Err(e) => {
            if let Some(source) = e
                .source()
                .and_then(|s| s.downcast_ref::<Arc<ConnectError>>())
            {
                if let ConnectError::Canceled = **source {
                    debug!("Reconnect was canceled, session is closing, returning Ok");
                    return Ok(());
                }
            }

            Err(napi_err(format!("error forwarding: {e:?}")))
        }
    }
}

async fn get_storage_by_id(id: &String) -> Result<Arc<Storage>> {
    // we must clone the Arc before any locking so there is a local reference
    // to the mutex to unlock if the tunnel wrapper struct is dropped.
    Ok(GLOBAL_TUNNELS
        .lock()
        .await
        .get(id)
        .ok_or(napi_err("Tunnel is no longer running"))?
        .clone()) // required clone
}

/// Delete any reference to the tunnel id
pub(crate) async fn remove_global_tunnel(id: &String) {
    GLOBAL_TUNNELS.lock().await.remove(id);
}

/// Close a tunnel with the given url, or all tunnels if no url is defined.
pub(crate) async fn close_url(url: Option<String>) -> Result<()> {
    let mut close_ids: Vec<String> = vec![];
    let tunnels = GLOBAL_TUNNELS.lock().await;
    for (id, storage) in tunnels.iter() {
        debug!("tunnel: {}", id);
        if url.as_ref().is_none() || url == storage.tun_meta.url {
            debug!("closing tunnel: {}", id);
            storage
                .session
                .close_tunnel(id)
                .await
                .map_err(|e| napi_ngrok_err("error closing tunnel", &e))?;
            close_ids.push(id.clone());
        }
    }
    drop(tunnels); // unlock GLOBAL_TUNNELS

    // remove references entirely
    for id in close_ids {
        remove_global_tunnel(&id).await;
    }
    Ok(())
}

/// Make a list of all tunnels by iterating over the global tunnel map and creating an NgrokTunnel from each.
pub(crate) async fn search_tunnels(
    session_id: Option<String>,
    url: Option<String>,
) -> Vec<NgrokTunnel> {
    let mut tunnels: Vec<NgrokTunnel> = vec![];
    for (_, storage) in GLOBAL_TUNNELS.lock().await.iter() {
        // filter by session_id, if provided
        if let Some(session_id) = session_id.as_ref() {
            if session_id.ne(&storage.session.id()) {
                continue;
            }
        }
        // filter by url, if provided
        if url.is_some() && url.ne(&storage.tun_meta.url) {
            continue;
        }
        // create a new NgrokTunnel from the storage
        tunnels.push(NgrokTunnel::from_storage(storage));
    }
    tunnels
}

/// Retrieve a list of non-closed tunnels, in no particular order.
#[napi]
pub async fn tunnels() -> Vec<NgrokTunnel> {
    search_tunnels(None, None).await
}

/// Retrieve tunnel using the id
#[napi]
pub async fn get_tunnel(id: String) -> Option<NgrokTunnel> {
    GLOBAL_TUNNELS
        .lock()
        .await
        .get(&id)
        .map(NgrokTunnel::from_storage)
}

/// Retrieve tunnel using the url
#[napi]
pub async fn get_tunnel_by_url(url: String) -> Option<NgrokTunnel> {
    search_tunnels(None, Some(url)).await.into_iter().next()
}
