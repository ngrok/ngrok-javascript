use napi::{
    Error,
    Status,
};
use ngrok::prelude::NgrokError;

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

pub(crate) fn napi_ngrok_err(message: impl Into<String>, err: &impl NgrokError) -> Error {
    let py_err = if let Some(error_code) = err.error_code() {
        Error::new(
            Status::GenericFailure,
            format!(
                "{}: {} error_code: {}",
                message.into(),
                err.msg(),
                error_code
            ),
        )
    } else {
        Error::new(
            Status::GenericFailure,
            format!("{}: {}", message.into(), err.msg()),
        )
    };
    py_err
}
