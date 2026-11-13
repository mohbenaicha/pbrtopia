use std::fmt;
use std::io;

/// Storage-backends R9: why a call failed. The page sees five of these (`wire_name`); the other two are library refusals that read as `busy` and `io` there.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ErrorKind {
    NoSpace,
    Denied,
    MissingRoot,
    Busy,
    Io,
    /// The library was made by the other app.
    WrongApp,
    /// The library is held by another copy of the app.
    Locked,
}

impl ErrorKind {
    pub fn wire_name(self) -> &'static str {
        match self {
            ErrorKind::NoSpace => "no-space",
            ErrorKind::Denied => "denied",
            ErrorKind::MissingRoot => "missing-root",
            ErrorKind::Busy | ErrorKind::Locked => "busy",
            ErrorKind::Io | ErrorKind::WrongApp => "io",
        }
    }
}

/// A failure with a message in plain words. The message never holds a path: the page must not learn where the library is from an error.
#[derive(Debug, Clone)]
pub struct CoreError {
    pub kind: ErrorKind,
    pub message: String,
}

pub type CoreResult<T> = Result<T, CoreError>;

impl CoreError {
    pub fn new(kind: ErrorKind, message: impl Into<String>) -> Self {
        CoreError { kind, message: message.into() }
    }
}

impl fmt::Display for CoreError {
    fn fmt(&self, f: &mut fmt::Formatter<'_>) -> fmt::Result {
        f.write_str(&self.message)
    }
}

impl std::error::Error for CoreError {}

const ERROR_ACCESS_DENIED: i32 = 5;
const ERROR_WRITE_PROTECT: i32 = 19;
const ERROR_SHARING_VIOLATION: i32 = 32;
const ERROR_LOCK_VIOLATION: i32 = 33;
const ERROR_HANDLE_DISK_FULL: i32 = 39;
const ERROR_DISK_FULL: i32 = 112;

impl From<&io::Error> for CoreError {
    fn from(error: &io::Error) -> Self {
        match error.raw_os_error() {
            Some(ERROR_DISK_FULL | ERROR_HANDLE_DISK_FULL) => return CoreError::new(ErrorKind::NoSpace, "The disk is full."),
            Some(ERROR_SHARING_VIOLATION | ERROR_LOCK_VIOLATION) => return CoreError::new(ErrorKind::Busy, "The file is in use by another program."),
            Some(ERROR_ACCESS_DENIED | ERROR_WRITE_PROTECT) => return CoreError::new(ErrorKind::Denied, "The folder would not let the app write."),
            _ => {}
        }
        match error.kind() {
            io::ErrorKind::StorageFull => CoreError::new(ErrorKind::NoSpace, "The disk is full."),
            io::ErrorKind::PermissionDenied | io::ErrorKind::ReadOnlyFilesystem => CoreError::new(ErrorKind::Denied, "The folder would not let the app write."),
            _ => CoreError::new(ErrorKind::Io, "A file operation failed."),
        }
    }
}

impl From<io::Error> for CoreError {
    fn from(error: io::Error) -> Self {
        CoreError::from(&error)
    }
}

impl From<rusqlite::Error> for CoreError {
    fn from(error: rusqlite::Error) -> Self {
        use rusqlite::ErrorCode;
        if let rusqlite::Error::SqliteFailure(failure, _) = &error {
            return match failure.code {
                ErrorCode::DiskFull => CoreError::new(ErrorKind::NoSpace, "The disk is full."),
                ErrorCode::DatabaseBusy | ErrorCode::DatabaseLocked => CoreError::new(ErrorKind::Busy, "The library database is in use."),
                ErrorCode::ReadOnly | ErrorCode::CannotOpen | ErrorCode::PermissionDenied => CoreError::new(ErrorKind::Denied, "The library database would not open for writing."),
                _ => CoreError::new(ErrorKind::Io, "The library database failed."),
            };
        }
        CoreError::new(ErrorKind::Io, "The library database failed.")
    }
}
