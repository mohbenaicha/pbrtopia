use super::{header_text, raw_body};
use crate::state::AppState;
use crate::wire_error::{refused, CommandResult};
use tauri::ipc::Request;
use tauri::{AppHandle, State};
use tauri_plugin_dialog::DialogExt;

// Files the user picks in a dialog Rust opened (R12, R13). The page gets an opaque handle, never the path.

/// The native Save dialog; the extension of `suggested_name` becomes the filter. `None` when the user closed it.
#[tauri::command]
pub async fn pick_save_file(app: AppHandle, state: State<'_, AppState>, suggested_name: String, description: String) -> CommandResult<Option<String>> {
    let mut dialog = app.dialog().file().set_file_name(&suggested_name);
    if let Some((_, extension)) = suggested_name.rsplit_once('.') {
        dialog = dialog.add_filter(&description, &[extension]);
    }
    let Some(picked) = dialog.blocking_save_file() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|_| refused("That file could not be used."))?;
    Ok(Some(state.handles.register_save_file(path)))
}

/// The native folder dialog for "Export selected". `None` when the user closed it.
#[tauri::command]
pub async fn pick_folder(app: AppHandle, state: State<'_, AppState>) -> CommandResult<Option<String>> {
    let Some(picked) = app.dialog().file().blocking_pick_folder() else {
        return Ok(None);
    };
    let path = picked.into_path().map_err(|_| refused("That folder could not be used."))?;
    Ok(Some(state.handles.register_folder(path)))
}

#[tauri::command]
pub async fn handle_folder_has(state: State<'_, AppState>, handle: String, name: String) -> CommandResult<bool> {
    Ok(state.handles.folder_has(&handle, &name)?)
}

/// A new file in a picked folder (never over an existing one); returns the handle to write it through.
#[tauri::command]
pub async fn handle_create_file(state: State<'_, AppState>, handle: String, name: String) -> CommandResult<String> {
    Ok(state.handles.create_file(&handle, &name)?)
}

/// A chunk as a raw body; the `handle` header names the file.
#[tauri::command]
pub async fn handle_write_chunk(state: State<'_, AppState>, request: Request<'_>) -> CommandResult<()> {
    let handle = header_text(&request, "handle")?;
    Ok(state.handles.write_chunk(handle, raw_body(&request)?)?)
}

#[tauri::command]
pub async fn handle_commit(state: State<'_, AppState>, handle: String) -> CommandResult<()> {
    Ok(state.handles.commit(&handle)?)
}

#[tauri::command]
pub async fn handle_abort(state: State<'_, AppState>, handle: String) -> CommandResult<()> {
    Ok(state.handles.abort(&handle)?)
}

/// Forgets a folder handle once the export is over.
#[tauri::command]
pub async fn handle_release(state: State<'_, AppState>, handle: String) -> CommandResult<()> {
    Ok(state.handles.release(&handle)?)
}
