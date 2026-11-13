use std::path::PathBuf;
use std::sync::{Mutex, MutexGuard};
use tauri::{AppHandle, Manager};
use texturium_core::files::FileStore;
use texturium_core::handles::HandleTable;
use texturium_core::library::Library;

/// What every command works on: the open library (none until the page opens it), the app's data folder, and the picked-file handles.
pub struct AppState {
    pub app_id: &'static str,
    pub app_data: PathBuf,
    pub home: PathBuf,
    pub library: Mutex<Option<Library>>,
    /// Rooted in the app's data folder; the page may touch `vault.json` there and nothing else (see `commands::files`).
    pub app_files: FileStore,
    pub handles: HandleTable,
}

impl AppState {
    pub fn new(app: &AppHandle) -> Result<AppState, Box<dyn std::error::Error>> {
        let app_data = app.path().app_data_dir()?;
        std::fs::create_dir_all(&app_data)?;
        let home = app.path().home_dir()?;
        // The two apps share this crate; their identifiers tell them apart (R15).
        let app_id = if app.config().identifier.ends_with(".materials") { "material" } else { "projection" };
        Ok(AppState { app_id, app_files: FileStore::new(&app_data), app_data, home, library: Mutex::new(None), handles: HandleTable::new() })
    }

    pub fn library(&self) -> MutexGuard<'_, Option<Library>> {
        self.library.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }
}
