//! The storage side of the desktop apps (specs/app/storage-backends): record store, files, path rules, library folder and picked-file handles.
//! No Tauri code lives here, so everything in it is tested with plain `cargo test` (tests/src-tauri/).

pub mod db;
pub mod error;
pub mod files;
pub mod handles;
pub mod library;
pub mod paths;
pub mod wire;
