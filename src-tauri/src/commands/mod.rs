//! Every command the page may call (storage-backends R12). Each is declared in build.rs and granted in capabilities/default.json.
//! Commands are `async` so their disk work runs off the window's main thread.

pub mod env;
pub mod files;
pub mod handles;
pub mod library;
pub mod records;

use crate::wire_error::{refused, CommandResult};
use tauri::ipc::{InvokeBody, Request};

/// The raw bytes a command was invoked with.
pub fn raw_body<'a>(request: &'a Request<'_>) -> CommandResult<&'a [u8]> {
    match request.body() {
        InvokeBody::Raw(bytes) => Ok(bytes),
        InvokeBody::Json(_) => Err(refused("The request carried no bytes.")),
    }
}

/// A text header of a raw-body command (raw bodies cannot also carry arguments).
pub fn header_text<'a>(request: &'a Request<'_>, name: &str) -> CommandResult<&'a str> {
    request.headers().get(name).and_then(|value| value.to_str().ok()).ok_or_else(|| refused("The request is missing a header."))
}
