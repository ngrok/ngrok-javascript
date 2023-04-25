use napi::{
    Error,
    Status,
};

pub mod config;
pub mod connect;
pub mod http;
pub mod logging;
pub mod session;
pub mod tcp;
pub mod tls;
pub mod tunnel;
pub mod tunnel_builder;

pub(crate) fn napi_err(message: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, message.into())
}
