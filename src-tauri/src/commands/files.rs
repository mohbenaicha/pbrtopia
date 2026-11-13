use super::{header_text, raw_body};
use crate::state::AppState;
use crate::wire_error::{library_not_open, refused, CommandResult};
use serde::{Deserialize, Serialize};
use tauri::ipc::{Request, Response};
use tauri::State;
use texturium_core::files::{EntryKind, FileStore};

/// Which folder a file command works in. The page may read and write `vault.json` in the app's data folder and anything in the library, nothing else (R12).
#[derive(Deserialize, Clone, Copy, PartialEq, Eq)]
#[serde(rename_all = "lowercase")]
pub enum Root {
    Library,
    Appdata,
}

impl Root {
    fn parse(text: &str) -> CommandResult<Root> {
        match text {
            "library" => Ok(Root::Library),
            "appdata" => Ok(Root::Appdata),
            _ => Err(refused("That folder is not one the page may use.")),
        }
    }
}

const VAULT_FILE: &str = "vault.json";

fn check_allowed(root: Root, path: &str) -> CommandResult<()> {
    if root == Root::Appdata && path != VAULT_FILE {
        return Err(refused("The app's data folder holds only the key vault."));
    }
    Ok(())
}

fn with_store<T>(state: &AppState, root: Root, path: &str, work: impl FnOnce(&FileStore) -> CommandResult<T>) -> CommandResult<T> {
    check_allowed(root, path)?;
    match root {
        Root::Appdata => work(&state.app_files),
        Root::Library => {
            let library = state.library();
            work(&library.as_ref().ok_or_else(library_not_open)?.files)
        }
    }
}

/// Up to `max` bytes from `offset`: `[0]` when there is no such file, otherwise `[1, ...bytes]` (empty bytes at the end).
#[tauri::command]
pub async fn file_read_chunk(state: State<'_, AppState>, root: Root, path: String, offset: u64, max: usize) -> CommandResult<Response> {
    let bytes = with_store(&state, root, &path, |store| Ok(store.read_chunk(&path, offset, max)?))?;
    Ok(Response::new(match bytes {
        Some(bytes) => {
            let mut out = Vec::with_capacity(bytes.len() + 1);
            out.push(1);
            out.extend_from_slice(&bytes);
            out
        }
        None => vec![0],
    }))
}

#[tauri::command]
pub async fn file_write_begin(state: State<'_, AppState>, root: Root, path: String) -> CommandResult<u64> {
    with_store(&state, root, &path, |store| Ok(store.write_begin(&path)?))
}

/// A chunk as a raw body; the headers name the folder (`root`) and the write (`id`).
#[tauri::command]
pub async fn file_write_chunk(state: State<'_, AppState>, request: Request<'_>) -> CommandResult<()> {
    let root = Root::parse(header_text(&request, "root")?)?;
    let id: u64 = header_text(&request, "id")?.parse().map_err(|_| refused("That write is not one the app started."))?;
    let bytes = raw_body(&request)?;
    with_store(&state, root, VAULT_FILE, |store| Ok(store.write_chunk(id, bytes)?))
}

#[tauri::command]
pub async fn file_write_commit(state: State<'_, AppState>, root: Root, id: u64) -> CommandResult<()> {
    with_store(&state, root, VAULT_FILE, |store| Ok(store.write_commit(id)?))
}

#[tauri::command]
pub async fn file_write_abort(state: State<'_, AppState>, root: Root, id: u64) -> CommandResult<()> {
    with_store(&state, root, VAULT_FILE, |store| Ok(store.write_abort(id)?))
}

#[tauri::command]
pub async fn file_remove(state: State<'_, AppState>, root: Root, path: String, recursive: bool) -> CommandResult<()> {
    with_store(&state, root, &path, |store| Ok(store.remove(&path, recursive)?))
}

#[derive(Serialize)]
pub struct ListedEntry {
    name: String,
    kind: &'static str,
    size: u64,
}

#[tauri::command]
pub async fn file_list(state: State<'_, AppState>, path: String) -> CommandResult<Vec<ListedEntry>> {
    let entries = with_store(&state, Root::Library, &path, |store| Ok(store.list(&path)?))?;
    Ok(entries
        .into_iter()
        .map(|entry| ListedEntry { name: entry.name, kind: if entry.kind == EntryKind::Dir { "dir" } else { "file" }, size: entry.size })
        .collect())
}

#[derive(Serialize)]
pub struct DiskSpace {
    free: u64,
    total: u64,
}

#[tauri::command]
pub async fn file_free_space(state: State<'_, AppState>) -> CommandResult<Option<DiskSpace>> {
    let space = with_store(&state, Root::Library, "", |store| Ok(store.free_space()?))?;
    Ok(space.map(|(free, total)| DiskSpace { free, total }))
}
