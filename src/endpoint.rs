use std::sync::Arc;

use lazy_static::lazy_static;
use napi::bindgen_prelude::*;
use napi_derive::napi;
use ngrok::{
    Agent,
    EndpointForwarder,
    EndpointListener,
};
use tokio::sync::Mutex;
use tracing::{
    debug,
    info,
};

use crate::{
    napi_err,
    napi_ngrok_err,
};

// no forward host section to allow for relative unix paths
pub(crate) const UNIX_PREFIX: &str = "unix:";
pub(crate) const TCP_PREFIX: &str = "tcp://";

lazy_static! {
    // endpoint references to be kept until explicit close, to prevent nodejs gc from dropping them.
    static ref GLOBAL_ENDPOINTS: Mutex<std::collections::HashMap<String, Arc<Storage>>> =
        Mutex::new(std::collections::HashMap::new());
}

/// A live listener or forwarder handle. `EndpointListener::close`/`EndpointForwarder::close`
/// both consume `self`, so this must be `Option`-wrapped to allow taking the value out.
enum Handle {
    Listener(EndpointListener),
    Forwarder(EndpointForwarder),
}

/// Stores the live handle and agent reference to be kept until explicit close.
struct Storage {
    handle: Mutex<Option<Handle>>,
    agent: Agent,
    meta: EndpointMetadata,
}

struct EndpointMetadata {
    id: String,
    url: String,
    proto: String,
    metadata: String,
    forwards_to: String,
}

/// An ngrok endpoint.
///
/// Created via {@link EndpointBuilder.listen} (a raw endpoint you accept connections on
/// yourself -- not currently exposed to JavaScript) or {@link EndpointBuilder.forward}
/// (ngrok auto-proxies connections to an upstream address; the common case).
///
/// NOTE: this fork's `Agent` API has no way to attach an upstream to an endpoint that is
/// already listening, and no labels concept, so the old `Listener.forward()` (attach
/// upstream after the fact), `Listener.join()` (await the forwarding task), and
/// `Listener.labels()` have no replacement and have been removed rather than kept as
/// always-failing stubs.
///
/// @group Agent
#[napi(custom_finalize)]
#[allow(dead_code)]
pub struct Endpoint {
    agent: Agent,
    id: String,
    url: String,
    proto: String,
    metadata: String,
    forwards_to: String,
}

impl Endpoint {
    fn from_storage(storage: &Arc<Storage>) -> Endpoint {
        Endpoint {
            agent: storage.agent.clone(),
            id: storage.meta.id.clone(),
            url: storage.meta.url.clone(),
            proto: storage.meta.proto.clone(),
            metadata: storage.meta.metadata.clone(),
            forwards_to: storage.meta.forwards_to.clone(),
        }
    }

    pub(crate) async fn new_listener(agent: Agent, raw_listener: EndpointListener) -> Endpoint {
        let id = raw_listener.id().to_string();
        let meta = EndpointMetadata {
            id: id.clone(),
            url: raw_listener.url().to_string(),
            proto: raw_listener.protocol().to_string(),
            metadata: raw_listener.metadata().to_string(),
            forwards_to: String::new(),
        };
        info!("Created endpoint {id:?} with url {:?}", raw_listener.url());
        let storage = Arc::new(Storage {
            handle: Mutex::new(Some(Handle::Listener(raw_listener))),
            agent,
            meta,
        });
        GLOBAL_ENDPOINTS.lock().await.insert(id, storage.clone());
        Endpoint::from_storage(&storage)
    }

    pub(crate) async fn new_forwarder(agent: Agent, forwarder: EndpointForwarder) -> Endpoint {
        let id = forwarder.id().to_string();
        let meta = EndpointMetadata {
            id: id.clone(),
            url: forwarder.url().to_string(),
            proto: forwarder.url().scheme().to_string(),
            metadata: String::new(),
            forwards_to: forwarder.upstream_url().to_string(),
        };
        info!("Created endpoint {id:?} with url {:?}", forwarder.url());
        let storage = Arc::new(Storage {
            handle: Mutex::new(Some(Handle::Forwarder(forwarder))),
            agent,
            meta,
        });
        GLOBAL_ENDPOINTS.lock().await.insert(id, storage.clone());
        Endpoint::from_storage(&storage)
    }
}

#[napi]
#[allow(dead_code)]
impl Endpoint {
    /// The public URL that this endpoint backs.
    #[napi]
    pub fn url(&self) -> String {
        self.url.clone()
    }

    /// The protocol of this endpoint (e.g. "https", "tcp").
    #[napi]
    pub fn proto(&self) -> String {
        self.proto.clone()
    }

    /// Returns an endpoint's unique ID.
    #[napi]
    pub fn id(&self) -> String {
        self.id.clone()
    }

    /// Returns the upstream address this endpoint forwards to, if any (only populated
    /// for endpoints created via {@link EndpointBuilder.forward}/{@link EndpointBuilder.serve}).
    #[napi]
    pub fn forwards_to(&self) -> String {
        self.forwards_to.clone()
    }

    /// Returns the arbitrary metadata string for this endpoint.
    #[napi]
    pub fn metadata(&self) -> String {
        self.metadata.clone()
    }

    /// Close the endpoint.
    #[napi]
    pub async fn close(&self) -> Result<()> {
        debug!("Endpoint closing, id: {}", self.id);

        let storage = get_storage_by_id(&self.id).await?;
        let res = {
            let mut guard = storage.handle.lock().await;
            match guard.take() {
                Some(Handle::Listener(l)) => l.close().await,
                Some(Handle::Forwarder(f)) => f.close().await,
                None => Ok(()),
            }
        }
        .map_err(|e| napi_ngrok_err("error closing endpoint", &e));

        GLOBAL_ENDPOINTS.lock().await.remove(&self.id);

        res
    }
}

impl ObjectFinalize for Endpoint {
    fn finalize(self, _env: Env) -> Result<()> {
        debug!("Endpoint finalize, id: {}", self.id);
        Ok(())
    }
}

async fn get_storage_by_id(id: &str) -> Result<Arc<Storage>> {
    Ok(GLOBAL_ENDPOINTS
        .lock()
        .await
        .get(id)
        .ok_or_else(|| napi_err("Endpoint is no longer running"))?
        .clone())
}

/// Delete any reference to the endpoint id
pub(crate) async fn remove_global_endpoint(id: &str) {
    GLOBAL_ENDPOINTS.lock().await.remove(id);
}

/// Close an endpoint with the given url, or all endpoints if no url is defined.
pub(crate) async fn close_url(url: Option<String>) -> Result<()> {
    let mut close_ids: Vec<String> = vec![];
    {
        let endpoints = GLOBAL_ENDPOINTS.lock().await;
        for (id, storage) in endpoints.iter() {
            debug!("endpoint: {}", id);
            if url.is_none() || url.as_deref() == Some(storage.meta.url.as_str()) {
                debug!("closing endpoint: {}", id);
                close_ids.push(id.clone());
            }
        }
    }

    for id in &close_ids {
        let storage = GLOBAL_ENDPOINTS.lock().await.get(id).cloned();
        if let Some(storage) = storage {
            let res = {
                let mut guard = storage.handle.lock().await;
                match guard.take() {
                    Some(Handle::Listener(l)) => l.close().await,
                    Some(Handle::Forwarder(f)) => f.close().await,
                    None => Ok(()),
                }
            };
            res.map_err(|e| napi_ngrok_err("error closing endpoint", &e))?;
        }
    }

    for id in close_ids {
        remove_global_endpoint(&id).await;
    }
    Ok(())
}

/// Make a list of all endpoints by iterating over the global endpoint map and creating an Endpoint from each.
pub(crate) async fn search_endpoints(
    session_id: Option<String>,
    url: Option<String>,
) -> Vec<Endpoint> {
    let mut endpoints: Vec<Endpoint> = vec![];
    for storage in GLOBAL_ENDPOINTS.lock().await.values() {
        // filter by session_id, if provided
        if let Some(session_id) = session_id.as_ref() {
            match storage.agent.session() {
                Some(s) if s.id() == session_id.as_str() => {}
                _ => continue,
            }
        }
        // filter by url, if provided
        if let Some(url) = url.as_ref() {
            if url.as_str() != storage.meta.url {
                continue;
            }
        }
        endpoints.push(Endpoint::from_storage(storage));
    }
    endpoints
}

/// Retrieve a list of non-closed endpoints, in no particular order.
#[napi]
pub async fn endpoints() -> Vec<Endpoint> {
    search_endpoints(None, None).await
}

/// Retrieve an endpoint using its id.
#[napi]
pub async fn get_endpoint(id: String) -> Option<Endpoint> {
    GLOBAL_ENDPOINTS
        .lock()
        .await
        .get(&id)
        .map(Endpoint::from_storage)
}

/// Retrieve an endpoint using its url.
#[napi]
pub async fn get_endpoint_by_url(url: String) -> Option<Endpoint> {
    search_endpoints(None, Some(url)).await.into_iter().next()
}
