use crate::error::{CoreError, CoreResult, ErrorKind};
use crate::files::{AtomicWriter, MAX_CHUNK_BYTES};
use crate::paths::check_single_name;
use std::collections::HashMap;
use std::path::PathBuf;
use std::sync::Mutex;

// Storage-backends R12, R13: what the user picks in a native dialog (opened by Rust) is kept here; the page gets only an opaque id.
// No call gives a path back. A file handle is good for one write; a folder handle stays good until released.

enum Entry {
    Folder(PathBuf),
    File { target: PathBuf, overwrite: bool, writer: Option<AtomicWriter> },
}

pub struct HandleTable {
    entries: Mutex<HashMap<String, Entry>>,
}

fn refused(message: &str) -> CoreError {
    CoreError::new(ErrorKind::Denied, message)
}

fn unknown() -> CoreError {
    refused("That file or folder is no longer available.")
}

fn new_id() -> String {
    let mut raw = [0u8; 16];
    if getrandom::fill(&mut raw).is_err() {
        raw = std::time::SystemTime::now().duration_since(std::time::UNIX_EPOCH).map(|elapsed| elapsed.as_nanos().to_le_bytes()).unwrap_or([7; 16]);
    }
    raw.iter().map(|byte| format!("{byte:02x}")).collect()
}

impl Default for HandleTable {
    fn default() -> Self {
        HandleTable::new()
    }
}

impl HandleTable {
    pub fn new() -> HandleTable {
        HandleTable { entries: Mutex::new(HashMap::new()) }
    }

    fn entries(&self) -> std::sync::MutexGuard<'_, HashMap<String, Entry>> {
        self.entries.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
    }

    fn insert(&self, entry: Entry) -> String {
        let id = new_id();
        self.entries().insert(id.clone(), entry);
        id
    }

    /// A file the user chose in the Save dialog; writing replaces it whole.
    pub fn register_save_file(&self, path: PathBuf) -> String {
        self.insert(Entry::File { target: path, overwrite: true, writer: None })
    }

    pub fn register_folder(&self, path: PathBuf) -> String {
        self.insert(Entry::Folder(path))
    }

    fn folder_of(entries: &HashMap<String, Entry>, handle: &str) -> CoreResult<PathBuf> {
        match entries.get(handle) {
            Some(Entry::Folder(path)) => Ok(path.clone()),
            _ => Err(unknown()),
        }
    }

    pub fn folder_has(&self, handle: &str, name: &str) -> CoreResult<bool> {
        check_single_name(name)?;
        let folder = HandleTable::folder_of(&self.entries(), handle)?;
        Ok(folder.join(name).exists())
    }

    /// A new file in the picked folder, as a handle of its own. A name that is already taken is refused, so nothing there is replaced.
    pub fn create_file(&self, handle: &str, name: &str) -> CoreResult<String> {
        check_single_name(name)?;
        let folder = HandleTable::folder_of(&self.entries(), handle)?;
        let target = folder.join(name);
        if target.exists() {
            return Err(refused("A file with that name is already there."));
        }
        Ok(self.insert(Entry::File { target, overwrite: false, writer: None }))
    }

    pub fn write_chunk(&self, handle: &str, bytes: &[u8]) -> CoreResult<()> {
        if bytes.len() > MAX_CHUNK_BYTES {
            return Err(refused("That piece is larger than one chunk may be."));
        }
        let mut entries = self.entries();
        match entries.get_mut(handle) {
            Some(Entry::File { target, overwrite, writer }) => {
                if writer.is_none() {
                    *writer = Some(AtomicWriter::create(target.clone(), *overwrite)?);
                }
                writer.as_mut().map(|open| open.chunk(bytes)).unwrap_or(Ok(()))
            }
            _ => Err(unknown()),
        }
    }

    /// Finishes the file: flushed and renamed into place whole. The handle is spent either way.
    pub fn commit(&self, handle: &str) -> CoreResult<()> {
        let mut entries = self.entries();
        if !matches!(entries.get(handle), Some(Entry::File { .. })) {
            return Err(unknown());
        }
        let Some(Entry::File { target, overwrite, writer }) = entries.remove(handle) else { return Err(unknown()) };
        drop(entries);
        let writer = match writer {
            Some(writer) => writer,
            None => AtomicWriter::create(target, overwrite)?,
        };
        writer.commit()
    }

    /// Drops a file handle and its temporary file; anything else, or an unknown handle, is left alone.
    pub fn abort(&self, handle: &str) -> CoreResult<()> {
        let mut entries = self.entries();
        if matches!(entries.get(handle), Some(Entry::File { .. })) {
            entries.remove(handle);
        }
        Ok(())
    }

    /// Ends a folder handle (after the last file of an export batch); harmless for an unknown one.
    pub fn release(&self, handle: &str) -> CoreResult<()> {
        self.entries().remove(handle);
        Ok(())
    }
}
