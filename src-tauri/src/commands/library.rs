use crate::state::AppState;
use crate::wire_error::{library_not_open, refused, CommandResult, WireError};
use serde::Serialize;
use std::path::{Path, PathBuf};
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;
use texturium_core::error::{CoreError, ErrorKind};
use texturium_core::library::{choose_library_folder, default_library_folder, load_config, open_library, save_config, AppConfig, Forbidden};

#[derive(Serialize)]
pub struct LibraryStatus {
    /// A library location has been remembered (false only on the very first start).
    configured: bool,
    /// The folder of the open library, for display in Settings; `None` while none is open.
    path: Option<String>,
}

#[derive(Serialize)]
#[serde(tag = "result", rename_all = "lowercase")]
pub enum ChooseOutcome {
    Chosen { path: String },
    Cancelled,
    Refused { message: String },
}

fn display(path: &Path) -> String {
    path.to_string_lossy().trim_start_matches("\\\\?\\").to_string()
}

/// Closes the open library (releasing its lock), opens `folder` and remembers it. When opening fails, the previous library is opened again.
fn switch_library(state: &AppState, folder: &Path) -> Result<PathBuf, WireError> {
    let mut slot = state.library();
    let previous = slot.take().map(|library| library.folder.clone());
    match open_library(folder, state.app_id) {
        Ok(library) => {
            let opened = library.folder.clone();
            *slot = Some(library);
            save_config(&state.app_data, &AppConfig { version: 1, library_path: display(&opened) })?;
            Ok(opened)
        }
        Err(error) => {
            if let Some(previous) = previous {
                *slot = open_library(&previous, state.app_id).ok();
            }
            Err(error.into())
        }
    }
}

fn open_chosen(state: &AppState, picked: &Path) -> CommandResult<ChooseOutcome> {
    let forbidden = Forbidden::from_env(state.app_data.clone());
    match choose_library_folder(picked, &forbidden) {
        Ok(folder) => Ok(ChooseOutcome::Chosen { path: display(&switch_library(state, &folder)?) }),
        Err(refusal) => Ok(ChooseOutcome::Refused { message: refusal.message().to_string() }),
    }
}

#[tauri::command]
pub async fn library_status(state: State<'_, AppState>) -> CommandResult<LibraryStatus> {
    let configured = load_config(&state.app_data)?.is_some();
    let path = state.library().as_ref().map(|library| display(&library.folder));
    Ok(LibraryStatus { configured, path })
}

/// Opens the remembered library. `None` when none was remembered yet (first start: the page then calls `library_choose`).
#[tauri::command]
pub async fn library_open(state: State<'_, AppState>) -> CommandResult<Option<String>> {
    let Some(config) = load_config(&state.app_data)? else {
        return Ok(None);
    };
    Ok(Some(display(&switch_library(&state, Path::new(&config.library_path))?)))
}

/// Cancelling the first-start dialog uses `%USERPROFILE%\Texturium` (or `Texturium Materials`), created when missing (R11).
#[tauri::command]
pub async fn library_use_default(state: State<'_, AppState>) -> CommandResult<String> {
    let folder = default_library_folder(&state.home, state.app_id);
    std::fs::create_dir_all(&folder).map_err(|error| WireError::from(CoreError::from(error)))?;
    Ok(display(&switch_library(&state, &folder)?))
}

/// Rust opens the native folder dialog and applies the refusals; the page passes no path and learns the folder only to show it (R12).
#[tauri::command]
pub async fn library_choose(app: AppHandle, state: State<'_, AppState>) -> CommandResult<ChooseOutcome> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(ChooseOutcome::Cancelled);
    };
    let picked = picked.into_path().map_err(|_| refused("That folder could not be used. Pick another."))?;
    open_chosen(&state, &picked)
}

#[tauri::command]
pub async fn library_show_in_folder(state: State<'_, AppState>) -> CommandResult<()> {
    let folder = state.library().as_ref().map(|library| library.folder.clone()).ok_or_else(library_not_open)?;
    std::process::Command::new("explorer").arg(&folder).spawn().map_err(|_| WireError { kind: ErrorKind::Io.wire_name(), message: "The folder could not be shown.".to_string() })?;
    Ok(())
}
