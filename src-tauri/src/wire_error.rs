use serde::Serialize;
use texturium_core::error::{CoreError, ErrorKind};

/// What the page receives when a command fails: the store error kind it maps (storage-backends R9) and a message in plain words.
#[derive(Debug, Serialize)]
pub struct WireError {
    pub kind: &'static str,
    pub message: String,
}

impl From<CoreError> for WireError {
    fn from(error: CoreError) -> Self {
        WireError { kind: error.kind.wire_name(), message: error.message }
    }
}

pub type CommandResult<T> = Result<T, WireError>;

pub fn library_not_open() -> WireError {
    WireError { kind: ErrorKind::Io.wire_name(), message: "The library is not open yet.".to_string() }
}

pub fn refused(message: &str) -> WireError {
    WireError { kind: ErrorKind::Denied.wire_name(), message: message.to_string() }
}
