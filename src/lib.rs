use napi::{
    Error,
    Status,
};

pub mod agent;
pub mod config;
pub mod connect;
pub mod endpoint;
pub mod endpoint_builder;
pub mod logging;

pub(crate) fn napi_err(message: impl Into<String>) -> Error {
    Error::new(Status::GenericFailure, message.into())
}

pub(crate) fn napi_ngrok_err(message: impl Into<String>, err: &ngrok::Error) -> Error {
    let msg = if let Some(code) = err.code() {
        format!("{}: {} error_code: {}", message.into(), err, code)
    } else {
        format!("{}: {}", message.into(), err)
    };
    Error::new(Status::GenericFailure, msg)
}
