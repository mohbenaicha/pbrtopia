use super::raw_body;
use crate::state::AppState;
use crate::wire_error::{library_not_open, CommandResult};
use tauri::ipc::{Request, Response};
use tauri::State;
use texturium_core::db::Query;
use texturium_core::wire::{encode_entries, parse_commit_body};

/// One record: `[0]` when absent, `[1, ...value bytes]` when present.
#[tauri::command]
pub async fn db_get(state: State<'_, AppState>, collection: String, key: String) -> CommandResult<Response> {
    let library = state.library();
    let library = library.as_ref().ok_or_else(library_not_open)?;
    let mut out = Vec::new();
    match library.db.get(&collection, &key)? {
        Some(value) => {
            out.push(1);
            out.extend_from_slice(&value);
        }
        None => out.push(0),
    }
    Ok(Response::new(out))
}

/// A collection's records in the data-model wire format: by a parent's key when `parent` is given, otherwise newest sort first.
#[tauri::command]
pub async fn db_list(state: State<'_, AppState>, collection: String, parent: Option<String>) -> CommandResult<Response> {
    let library = state.library();
    let library = library.as_ref().ok_or_else(library_not_open)?;
    let entries = match &parent {
        Some(parent) => library.db.list(&collection, &Query::Parent(parent))?,
        None => library.db.list(&collection, &Query::SortDescending)?,
    };
    Ok(Response::new(encode_entries(&entries)))
}

/// One transaction as a raw body (data-model wire format), applied all or none.
#[tauri::command]
pub async fn db_commit(state: State<'_, AppState>, request: Request<'_>) -> CommandResult<()> {
    let ops = parse_commit_body(raw_body(&request)?)?;
    let library = state.library();
    let library = library.as_ref().ok_or_else(library_not_open)?;
    library.db.commit(&ops)?;
    Ok(())
}
