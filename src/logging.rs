use lazy_static::lazy_static;
use napi::{
    bindgen_prelude::*,
    threadsafe_function::{
        ErrorStrategy,
        ThreadSafeCallContext,
        ThreadsafeFunction,
        ThreadsafeFunctionCallMode,
    },
};
use napi_derive::napi;
use parking_lot::Mutex;
use tracing::metadata::LevelFilter;
use tracing_subscriber::{
    prelude::*,
    Layer,
};

use crate::napi_err;

// keep a reference to the javascript logging callback function.
// uses synchronous parking_lot mutex to avoid needing napi Env, and encourage maintaining log sequence.
lazy_static! {
    static ref GLOBAL_DATA: Mutex<Option<ThreadsafeFunction<Vec<String>, ErrorStrategy::Fatal>>> =
        Mutex::new(None);
}

/// tracing subscriber layer to plumb events to javascript
struct CustomLayer;

impl<S> Layer<S> for CustomLayer
where
    S: tracing::Subscriber,
{
    fn on_event(
        &self,
        event: &tracing::Event<'_>,
        _ctx: tracing_subscriber::layer::Context<'_, S>,
    ) {
        let mut visitor = EventVisitor {
            ..Default::default()
        };
        event.record(&mut visitor);
        if let Err(err) = log_to_callback(
            event.metadata().level().to_string(),
            event.metadata().target().to_string(),
            visitor.message,
        ) {
            println!("Error logging to javascript function: {err:?}");
        }
    }
}

/// Visitor to record the message from the event record
#[derive(Default)]
struct EventVisitor {
    message: String,
}

impl tracing::field::Visit for EventVisitor {
    // everything currently used comes through as a fmt debug
    fn record_debug(&mut self, field: &tracing::field::Field, value: &dyn std::fmt::Debug) {
        if field.name() == "message" {
            self.message = format!("{value:?}");
        }
    }
}

/// Send the strings to the javascript callback, if one is registered
pub fn log_to_callback(level: String, target: String, message: String) -> Result<()> {
    if let Some(tsfn) = GLOBAL_DATA.lock().as_ref() {
        let status = tsfn.call(
            vec![level, target, message],
            ThreadsafeFunctionCallMode::NonBlocking,
        );
        if status != Status::Ok {
            return Err(napi_err(status.to_string()));
        }
    }
    Ok(())
}

/// Register a callback function that will receive logging event information.
/// An absent callback will unregister an existing callback function.
/// The log level defaults to INFO, it can be set to one of ERROR, WARN, INFO, DEBUG, or TRACE.
#[napi(
    ts_args_type = "callback?: (level: string, target: string, message: string) => void, level?: string"
)]
pub fn logging_callback(
    env: Env,
    callback: Option<JsFunction>,
    level: Option<String>,
) -> Result<()> {
    if callback.is_none() {
        // clear out any registered callback
        GLOBAL_DATA.lock().take();
        return Ok(());
    }

    // create the threadsafe function wrapper
    let mut tsfn: ThreadsafeFunction<Vec<String>, ErrorStrategy::Fatal> = callback
        .unwrap()
        .create_threadsafe_function(0, |ctx: ThreadSafeCallContext<Vec<String>>| {
            Ok(ctx
                .value
                .iter()
                .map(|s| ctx.env.create_string_from_std(s.clone()))
                .collect())
        })?;
    // tell the runtime it can exit while this callback exists
    tsfn.unref(&env)?;

    // store the global callback
    let _ = GLOBAL_DATA.lock().insert(tsfn);

    let tracing_level = if let Some(level) = level {
        match level.to_uppercase().as_str() {
            "ERROR" => LevelFilter::ERROR,
            "WARN" => LevelFilter::WARN,
            "INFO" => LevelFilter::INFO,
            "DEBUG" => LevelFilter::DEBUG,
            "TRACE" => LevelFilter::TRACE,
            _ => return Err(napi_err("Unknown log level: {level:?}")),
        }
    } else {
        LevelFilter::INFO
    };

    if let Err(err) = tracing_subscriber::registry()
        .with(CustomLayer)
        .with(tracing_level)
        .try_init()
    {
        if !err.to_string().contains("already been set") {
            return Err(napi_err(format!("Failed to subscribe logger, {err:?}")));
        }
    }

    Ok(())
}
