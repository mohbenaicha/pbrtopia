use crate::error::{CoreError, CoreResult, ErrorKind};
use crate::paths::{is_reparse_point, resolve};
use std::collections::{HashMap, HashSet};
use std::fs::{self, File};
use std::io::{self, Read, Seek, SeekFrom, Write};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::Mutex;
use std::thread;
use std::time::Duration;

/// Storage-backends R8: the most bytes that cross to or from disk in one piece.
pub const MAX_CHUNK_BYTES: usize = 8 * 1024 * 1024;
const RENAME_ATTEMPTS: u32 = 10;
const RENAME_PAUSE: Duration = Duration::from_millis(30);

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum EntryKind {
    File,
    Dir,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct FileEntry {
    pub name: String,
    pub kind: EntryKind,
    pub size: u64,
}

fn is_temporary(name: &str) -> bool {
    name.to_ascii_lowercase().ends_with(".tmp")
}

fn too_big() -> CoreError {
    CoreError::new(ErrorKind::Denied, "That piece is larger than one chunk may be.")
}

fn random_hex(bytes: usize) -> CoreResult<String> {
    let mut raw = vec![0u8; bytes];
    getrandom::fill(&mut raw).map_err(|_| CoreError::new(ErrorKind::Io, "No random numbers were available."))?;
    Ok(raw.iter().map(|byte| format!("{byte:02x}")).collect())
}

/// A file being written: the bytes go to `<name>.<random>.tmp` in the target's folder; `commit` flushes it and renames it over the target,
/// so a reader never sees a half-written file (R8). Dropping the writer without committing removes the temporary file.
pub struct AtomicWriter {
    target: PathBuf,
    temp: PathBuf,
    file: Option<File>,
    overwrite: bool,
    finished: bool,
}

impl AtomicWriter {
    pub fn create(target: PathBuf, overwrite: bool) -> CoreResult<AtomicWriter> {
        let name = target.file_name().map(|name| name.to_string_lossy().into_owned()).ok_or_else(|| CoreError::new(ErrorKind::Denied, "That is not a file."))?;
        if let Some(folder) = target.parent() {
            fs::create_dir_all(folder)?;
        }
        let temp = target.with_file_name(format!("{name}.{}.tmp", random_hex(4)?));
        let file = fs::OpenOptions::new().write(true).create_new(true).open(&temp)?;
        Ok(AtomicWriter { target, temp, file: Some(file), overwrite, finished: false })
    }

    pub fn temp_path(&self) -> &Path {
        &self.temp
    }

    pub fn chunk(&mut self, bytes: &[u8]) -> CoreResult<()> {
        if bytes.len() > MAX_CHUNK_BYTES {
            return Err(too_big());
        }
        let file = self.file.as_mut().ok_or_else(|| CoreError::new(ErrorKind::Io, "The write has finished."))?;
        file.write_all(bytes)?;
        Ok(())
    }

    /// Flushes to disk, then renames over the target, retrying briefly when another program has the target open. On failure the temporary file is removed and the old target is untouched.
    pub fn commit(mut self) -> CoreResult<()> {
        let result = self.finish();
        self.discard_temp();
        result
    }

    pub fn abort(mut self) {
        self.discard_temp();
    }

    fn finish(&mut self) -> CoreResult<()> {
        let file = self.file.take().ok_or_else(|| CoreError::new(ErrorKind::Io, "The write has finished."))?;
        file.sync_all()?;
        drop(file);
        if !self.overwrite && self.target.exists() {
            return Err(CoreError::new(ErrorKind::Denied, "A file with that name is already there."));
        }
        for attempt in 1..=RENAME_ATTEMPTS {
            match fs::rename(&self.temp, &self.target) {
                Ok(()) => {
                    self.finished = true;
                    return Ok(());
                }
                Err(error) => {
                    let failure = CoreError::from(&error);
                    let worth_retrying = matches!(failure.kind, ErrorKind::Busy | ErrorKind::Denied);
                    if !worth_retrying || attempt == RENAME_ATTEMPTS {
                        return Err(failure);
                    }
                    thread::sleep(RENAME_PAUSE);
                }
            }
        }
        Err(CoreError::new(ErrorKind::Busy, "The file is in use by another program."))
    }

    fn discard_temp(&mut self) {
        self.file = None;
        if !self.finished {
            let _ = fs::remove_file(&self.temp);
            self.finished = true;
        }
    }
}

impl Drop for AtomicWriter {
    fn drop(&mut self) {
        self.discard_temp();
    }
}

/// Storage-backends R8, R12: the files under the library folder, addressed by safe relative paths.
pub struct FileStore {
    root: PathBuf,
    writers: Mutex<HashMap<u64, AtomicWriter>>,
    next_id: AtomicU64,
    cleaned: Mutex<HashSet<PathBuf>>,
}

fn lock<T>(mutex: &Mutex<T>) -> std::sync::MutexGuard<'_, T> {
    mutex.lock().unwrap_or_else(|poisoned| poisoned.into_inner())
}

impl FileStore {
    pub fn new(root: impl Into<PathBuf>) -> FileStore {
        FileStore { root: root.into(), writers: Mutex::new(HashMap::new()), next_id: AtomicU64::new(1), cleaned: Mutex::new(HashSet::new()) }
    }

    /// Up to `max` bytes from `offset`; `None` when there is no such file, an empty piece at or past the end.
    pub fn read_chunk(&self, rel: &str, offset: u64, max: usize) -> CoreResult<Option<Vec<u8>>> {
        let path = resolve(&self.root, rel, false)?;
        let mut file = match File::open(&path) {
            Ok(file) => file,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(None),
            Err(error) => return Err(error.into()),
        };
        if file.metadata()?.is_dir() {
            return Ok(None);
        }
        file.seek(SeekFrom::Start(offset))?;
        let mut piece = vec![0u8; max.min(MAX_CHUNK_BYTES)];
        let mut filled = 0;
        while filled < piece.len() {
            let read = file.read(&mut piece[filled..])?;
            if read == 0 {
                break;
            }
            filled += read;
        }
        piece.truncate(filled);
        Ok(Some(piece))
    }

    pub fn write_begin(&self, rel: &str) -> CoreResult<u64> {
        let path = resolve(&self.root, rel, false)?;
        let writer = AtomicWriter::create(path, true)?;
        let id = self.next_id.fetch_add(1, Ordering::SeqCst);
        lock(&self.writers).insert(id, writer);
        Ok(id)
    }

    pub fn write_chunk(&self, id: u64, bytes: &[u8]) -> CoreResult<()> {
        let mut writers = lock(&self.writers);
        let writer = writers.get_mut(&id).ok_or_else(|| CoreError::new(ErrorKind::Denied, "There is no such write in progress."))?;
        writer.chunk(bytes)
    }

    pub fn write_commit(&self, id: u64) -> CoreResult<()> {
        let writer = lock(&self.writers).remove(&id).ok_or_else(|| CoreError::new(ErrorKind::Denied, "There is no such write in progress."))?;
        writer.commit()
    }

    /// Removes the temporary file; aborting a write that is not there is harmless.
    pub fn write_abort(&self, id: u64) -> CoreResult<()> {
        if let Some(writer) = lock(&self.writers).remove(&id) {
            writer.abort();
        }
        Ok(())
    }

    /// Succeeds when the target is absent; a folder needs `recursive`. The library folder itself is never removed.
    pub fn remove(&self, rel: &str, recursive: bool) -> CoreResult<()> {
        let path = resolve(&self.root, rel, false)?;
        let metadata = match fs::symlink_metadata(&path) {
            Ok(metadata) => metadata,
            Err(error) if error.kind() == io::ErrorKind::NotFound => return Ok(()),
            Err(error) => return Err(error.into()),
        };
        if metadata.is_dir() {
            if recursive {
                fs::remove_dir_all(&path)?;
            } else {
                fs::remove_dir(&path)?;
            }
        } else {
            fs::remove_file(&path)?;
        }
        Ok(())
    }

    /// The entries of one folder, temporary files left out; empty when it does not exist. The first time a folder is listed in a run,
    /// temporary files no live write owns (left by a crash) are removed.
    pub fn list(&self, rel: &str) -> CoreResult<Vec<FileEntry>> {
        let folder = resolve(&self.root, rel, true)?;
        let reader = match fs::read_dir(&folder) {
            Ok(reader) => reader,
            Err(error) if matches!(error.kind(), io::ErrorKind::NotFound | io::ErrorKind::NotADirectory) => return Ok(Vec::new()),
            Err(error) => return Err(error.into()),
        };
        let first_time = lock(&self.cleaned).insert(folder.clone());
        let live: HashSet<PathBuf> = lock(&self.writers).values().map(|writer| writer.temp_path().to_path_buf()).collect();
        let mut entries = Vec::new();
        for item in reader {
            let item = item?;
            let name = item.file_name().to_string_lossy().into_owned();
            let metadata = match fs::symlink_metadata(item.path()) {
                Ok(metadata) => metadata,
                Err(_) => continue,
            };
            if is_temporary(&name) {
                if first_time && !live.contains(&item.path()) {
                    let _ = fs::remove_file(item.path());
                }
                continue;
            }
            if is_reparse_point(&metadata) {
                continue;
            }
            let (kind, size) = if metadata.is_dir() { (EntryKind::Dir, 0) } else { (EntryKind::File, metadata.len()) };
            entries.push(FileEntry { name, kind, size });
        }
        Ok(entries)
    }

    /// Free and total bytes of the disk the library is on; `None` when the disk will not say.
    pub fn free_space(&self) -> CoreResult<Option<(u64, u64)>> {
        if !self.root.is_dir() {
            return Err(CoreError::new(ErrorKind::MissingRoot, "The library folder cannot be found."));
        }
        match (fs4::available_space(&self.root), fs4::total_space(&self.root)) {
            (Ok(free), Ok(total)) => Ok(Some((free.min(total), total))),
            _ => Ok(None),
        }
    }
}
