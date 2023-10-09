use core::result::Result as CoreResult;
use std::{
    collections::HashMap,
    error::Error,
    io,
    sync::Arc,
};

use async_trait::async_trait;
use futures::prelude::*;
use lazy_static::lazy_static;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    forwarder::Forwarder,
    prelude::*,
    session::ConnectError,
    tunnel::{
        HttpTunnel,
        LabeledTunnel,
        TcpTunnel,
        TlsTunnel,
    },
    Session,
};
use regex::Regex;
use tokio::{
    sync::Mutex,
    task::JoinHandle,
};
use tracing::{
    debug,
    info,
};
use url::Url;

use crate::{
    napi_err,
    napi_ngrok_err,
};

// no forward host section to allow for relative unix paths
pub(crate) const UNIX_PREFIX: &str = "unix:";
pub(crate) const TCP_PREFIX: &str = "tcp://";

lazy_static! {
    // listener references to be kept until explicit close to prevent nodejs gc from dropping them.
    // the listener wrapper object, and the underlying listener, both have references to the Session
    // so the Session is safe from premature dropping.
    static ref GLOBAL_LISTENERS: Mutex<HashMap<String,Arc<Storage>>> = Mutex::new(HashMap::new());
}

/// Stores the listener and session references to be kept until explicit close.
struct Storage {
    listener: Option<Arc<Mutex<dyn ExtendedListener>>>,
    forwarder: Option<Arc<Mutex<dyn ExtendedForwarder>>>,
    session: Session,
    tun_meta: Arc<ListenerMetadata>,
}

struct ListenerMetadata {
    id: String,
    forwards_to: String,
    metadata: String,
    url: Option<String>,
    proto: Option<String>,
    labels: HashMap<String, String>,
}

/// The upstream cannot be turned into an object since it contains generics, so implementing
/// a proxy trait without generics which can be the dyn type stored in the global map.
#[async_trait]
pub trait ExtendedListener: Send {
    async fn fwd(&mut self, url: Url) -> CoreResult<(), io::Error>;
}

pub trait ExtendedForwarder: Send {
    fn get_join(&mut self) -> &mut JoinHandle<CoreResult<(), io::Error>>;
}

/// An ngrok listener.
///
/// @group Listener and Sessions
#[napi(custom_finalize)]
#[allow(dead_code)]
pub struct Listener {
    session: Session,
    tun_meta: Arc<ListenerMetadata>,
}

macro_rules! make_listener_type {
    // the common (non-labeled) branch
    ($(#[$outer:meta])* $wrapper:ident, $listener:tt, common) => {
        $(#[$outer])*
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new_listener(session: Session, raw_listener: $listener) -> Listener {
                let id = raw_listener.id().to_string();
                let tun_meta = Arc::new(ListenerMetadata {
                    id: id.clone(),
                    forwards_to: raw_listener.forwards_to().to_string(),
                    metadata: raw_listener.metadata().to_string(),
                    url: Some(raw_listener.url().to_string()),
                    proto: Some(raw_listener.proto().to_string()),
                    labels: HashMap::new(),
                });
                info!("Created listener {id:?} with url {:?}", raw_listener.url());
                // keep a listener reference until an explicit call to close to prevent nodejs gc dropping it
                let storage = Arc::new(Storage {
                    listener: Some(Arc::new(Mutex::new(raw_listener))),
                    forwarder: None,
                    session,
                    tun_meta,
                });
                GLOBAL_LISTENERS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                Listener::from_storage(&storage)
            }

            pub(crate) async fn new_forwarder(session: Session, forwarder: Forwarder<$listener>) -> Listener {
                let id = forwarder.id().to_string();
                let tun_meta = Arc::new(ListenerMetadata {
                    id: id.clone(),
                    forwards_to: forwarder.forwards_to().to_string(),
                    metadata: forwarder.metadata().to_string(),
                    url: Some(forwarder.url().to_string()),
                    proto: Some(forwarder.proto().to_string()),
                    labels: HashMap::new(),
                });
                info!("Created listener {id:?} with url {:?}", forwarder.url());
                // keep a listener reference until an explicit call to close to prevent python gc dropping it
                let storage = Arc::new(Storage {
                    listener: None,
                    forwarder: Some(Arc::new(Mutex::new(forwarder))),
                    session,
                    tun_meta,
                });
                GLOBAL_LISTENERS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                Listener::from_storage(&storage)
            }
        }

        make_listener_type!($wrapper, $listener);
    };

    // the labeled branch
    ($(#[$outer:meta])* $wrapper:ident, $listener:tt, label) => {
        #[allow(dead_code)]
        pub(crate) struct $wrapper {
        }

        #[napi]
        #[allow(dead_code)]
        impl $wrapper {
            pub(crate) async fn new_listener(session: Session, raw_listener: $listener) -> Listener {
                let id = raw_listener.id().to_string();
                let tun_meta = Arc::new(ListenerMetadata {
                    id: id.clone(),
                    forwards_to: raw_listener.forwards_to().to_string(),
                    metadata: raw_listener.metadata().to_string(),
                    url: None,
                    proto: None,
                    labels: raw_listener.labels().clone(),
                });
                info!("Created listener {id:?} with labels {:?}", tun_meta.labels);
                // keep a listener reference until an explicit call to close to prevent nodejs gc dropping it
                let storage = Arc::new(Storage {
                    listener: Some(Arc::new(Mutex::new(raw_listener))),
                    forwarder: None,
                    session,
                    tun_meta,
                });
                GLOBAL_LISTENERS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                Listener::from_storage(&storage)
            }

            pub(crate) async fn new_forwarder(session: Session, forwarder: Forwarder<$listener>) -> Listener {
                let id = forwarder.id().to_string();
                let tun_meta = Arc::new(ListenerMetadata {
                    id: id.clone(),
                    forwards_to: forwarder.forwards_to().to_string(),
                    metadata: forwarder.metadata().to_string(),
                    url: None,
                    proto: None,
                    labels: forwarder.labels().clone(),
                });
                info!("Created listener {id:?} with labels {:?}", tun_meta.labels);
                // keep a listener reference until an explicit call to close to prevent python gc dropping it
                let storage = Arc::new(Storage {
                    listener: None,
                    forwarder: Some(Arc::new(Mutex::new(forwarder))),
                    session,
                    tun_meta,
                });
                GLOBAL_LISTENERS.lock().await.insert(id, storage.clone());
                // create the user-facing object
                Listener::from_storage(&storage)
            }
        }

        make_listener_type!($wrapper, $listener);
    };

    // all listeners get these
    ($wrapper:ident, $listener:tt) => {
        #[async_trait]
        impl ExtendedListener for $listener {
            #[allow(deprecated)]
            async fn fwd(&mut self, url: Url) -> CoreResult<(), io::Error> {
                ngrok::prelude::TunnelExt::forward(self, url).await
            }
        }

        impl ExtendedForwarder for Forwarder<$listener> {
            fn get_join(&mut self) -> &mut JoinHandle<CoreResult<(), io::Error>> {
                self.join()
            }
        }
    };
}

#[napi]
#[allow(dead_code)]
impl Listener {
    /// Create Listener from Storage
    fn from_storage(storage: &Arc<Storage>) -> Listener {
        // create the user-facing object
        Listener {
            session: storage.session.clone(),
            tun_meta: storage.tun_meta.clone(),
        }
    }

    /// The URL that this listener backs.
    #[napi]
    pub fn url(&self) -> Option<String> {
        self.tun_meta.url.clone()
    }

    /// The protocol of the endpoint that this listener backs.
    #[napi]
    pub fn proto(&self) -> Option<String> {
        self.tun_meta.proto.clone()
    }

    /// The labels this listener was started with.
    #[napi]
    pub fn labels(&self) -> HashMap<String, String> {
        self.tun_meta.labels.clone()
    }

    /// Returns a listener's unique ID.
    #[napi]
    pub fn id(&self) -> String {
        self.tun_meta.id.clone()
    }

    /// Returns a human-readable string presented in the ngrok dashboard
    /// and the API. Use the [HttpListenerBuilder::forwards_to],
    /// [TcpListenerBuilder::forwards_to], etc. to set this value
    /// explicitly.
    #[napi]
    pub fn forwards_to(&self) -> String {
        self.tun_meta.forwards_to.clone()
    }

    /// Returns the arbitrary metadata string for this listener.
    #[napi]
    pub fn metadata(&self) -> String {
        self.tun_meta.metadata.clone()
    }

    /// Forward incoming listener connections. This can be either a TCP address or a file socket path.
    /// For file socket paths on Linux/Darwin, addr can be a unix domain socket path, e.g. "/tmp/ngrok.sock"
    ///     On Windows, addr can be a named pipe, e.e. "\\\\.\\pipe\\an_ngrok_pipe
    #[napi]
    pub async fn forward(&self, addr: String) -> Result<()> {
        forward(&self.tun_meta.id, addr).await
    }

    /// Wait for the forwarding task to exit.
    #[napi]
    pub async fn join(&self) -> Result<()> {
        let id = self.tun_meta.id.clone();
        let forwarder_option = &get_storage_by_id(&id).await?.forwarder;
        if let Some(forwarder_mutex) = forwarder_option {
            forwarder_mutex
                .lock()
                .await
                .get_join()
                .fuse()
                .await
                .map_err(|e| napi_err(format!("error on join: {e:?}")))?
                .map_err(|e| napi_err(format!("error on join: {e:?}")))
        } else {
            Err(napi_err("Listener is not joinable"))
        }
    }

    /// Close the listener.
    ///
    /// This is an RPC call that must be `.await`ed.
    /// It is equivalent to calling `Session::close_listener` with this
    /// listener's ID.
    #[napi]
    pub async fn close(&self) -> Result<()> {
        debug!("Listener closing, id: {}", self.tun_meta.id);

        // we may not be able to lock our reference to the listener due to the forward_* calls which
        // continuously accept-loop while the listener is active, so calling close on the Session.
        let res = self
            .session
            .close_tunnel(self.tun_meta.id.clone())
            .await
            .map_err(|e| napi_ngrok_err("error closing listener", &e));

        // drop our internal reference to the listener after awaiting close
        GLOBAL_LISTENERS.lock().await.remove(&self.tun_meta.id);

        res
    }
}

#[allow(unused_mut)]
impl ObjectFinalize for Listener {
    fn finalize(mut self, _env: Env) -> Result<()> {
        debug!("Listener finalize, id: {}", self.tun_meta.id);
        Ok(())
    }
}

make_listener_type! {
    /// An ngrok listener backing an HTTP endpoint.
    ///
    /// @group Listeners
    HttpListener, HttpTunnel, common
}
make_listener_type! {
    /// An ngrok listener backing a TCP endpoint.
    ///
    /// @group Listeners
    TcpListener, TcpTunnel, common
}
make_listener_type! {
    /// An ngrok listener bcking a TLS endpoint.
    ///
    /// @group Listeners
    TlsListener, TlsTunnel, common
}
make_listener_type! {
    /// A labeled ngrok listener.
    ///
    /// @group Listeners
    LabeledListener, LabeledTunnel, label
}

pub async fn forward(id: &String, mut addr: String) -> Result<()> {
    let tun_option = &get_storage_by_id(id).await?.listener;
    if let Some(tun) = tun_option {
        // if addr is not a full url, choose a default protocol
        lazy_static! {
            static ref RE: Regex = Regex::new(r"^[a-z0-9\-\.]+:\d+$").unwrap();
        }
        if !addr.contains(':') || RE.find(&addr).is_some() {
            if addr.contains('/') {
                addr = format!("{UNIX_PREFIX}{addr}")
            } else {
                addr = format!("{TCP_PREFIX}{addr}")
            }
        }
        // parse to a url
        let url = Url::parse(addr.as_str())
            .map_err(|e| napi_err(format!("Cannot parse address: {addr}, error: {e}")))?;

        info!("Listener {id:?} forwarding to {:?}", url.to_string());
        let res = tun.lock().await.fwd(url).await;

        debug!("forward returning");
        canceled_is_ok(res)
    } else {
        Err(napi_err("listener is not forwardable"))
    }
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
    // to the mutex to unlock if the listener wrapper struct is dropped.
    Ok(GLOBAL_LISTENERS
        .lock()
        .await
        .get(id)
        .ok_or(napi_err("Listener is no longer running"))?
        .clone()) // required clone
}

/// Delete any reference to the listener id
pub(crate) async fn remove_global_listener(id: &String) {
    GLOBAL_LISTENERS.lock().await.remove(id);
}

/// Close a listener with the given url, or all listeners if no url is defined.
pub(crate) async fn close_url(url: Option<String>) -> Result<()> {
    let mut close_ids: Vec<String> = vec![];
    let listeners = GLOBAL_LISTENERS.lock().await;
    for (id, storage) in listeners.iter() {
        debug!("listener: {}", id);
        if url.as_ref().is_none() || url == storage.tun_meta.url {
            debug!("closing listener: {}", id);
            storage
                .session
                .close_tunnel(id)
                .await
                .map_err(|e| napi_ngrok_err("error closing listener", &e))?;
            close_ids.push(id.clone());
        }
    }
    drop(listeners); // unlock GLOBAL_LISTENERS

    // remove references entirely
    for id in close_ids {
        remove_global_listener(&id).await;
    }
    Ok(())
}

/// Make a list of all listeners by iterating over the global listener map and creating an Listener from each.
pub(crate) async fn search_listeners(
    session_id: Option<String>,
    url: Option<String>,
) -> Vec<Listener> {
    let mut listeners: Vec<Listener> = vec![];
    for (_, storage) in GLOBAL_LISTENERS.lock().await.iter() {
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
        // create a new Listener from the storage
        listeners.push(Listener::from_storage(storage));
    }
    listeners
}

/// Retrieve a list of non-closed listeners, in no particular order.
#[napi]
pub async fn listeners() -> Vec<Listener> {
    search_listeners(None, None).await
}

/// Retrieve listener using the id
#[napi]
pub async fn get_listener(id: String) -> Option<Listener> {
    GLOBAL_LISTENERS
        .lock()
        .await
        .get(&id)
        .map(Listener::from_storage)
}

/// Retrieve listener using the url
#[napi]
pub async fn get_listener_by_url(url: String) -> Option<Listener> {
    search_listeners(None, Some(url)).await.into_iter().next()
}
