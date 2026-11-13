use crate::db::Db;
use crate::error::{CoreError, CoreResult, ErrorKind};
use crate::files::{AtomicWriter, FileStore};
use serde::{Deserialize, Serialize};
use std::fs::{self, File, OpenOptions, TryLockError};
use std::path::{Component, Path, PathBuf};

// Storage-backends R5, R11, R14: where the library is, which folders may not be one, and who holds it.

const DATABASE_FILE: &str = "library.db";
const LOCK_FILE: &str = "library.lock";
const CONFIG_FILE: &str = "config.json";
const SUBFOLDER: &str = "Texturium";

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum Refusal {
    DriveRoot,
    WindowsFolder,
    ProgramFiles,
    AppDataFolder,
    CannotCreate,
}

impl Refusal {
    pub fn message(self) -> &'static str {
        match self {
            Refusal::DriveRoot => "A whole drive cannot be the library. Pick a folder on it.",
            Refusal::WindowsFolder => "The Windows folder cannot be the library.",
            Refusal::ProgramFiles => "The Program Files folder cannot be the library.",
            Refusal::AppDataFolder => "That folder belongs to the app itself. Pick another.",
            Refusal::CannotCreate => "That folder could not be used. Pick another.",
        }
    }
}

/// The folders a library may not be, or be inside (R11).
pub struct Forbidden {
    windows: Vec<PathBuf>,
    program_files: Vec<PathBuf>,
    app_data: PathBuf,
}

impl Forbidden {
    pub fn new(windows: Vec<PathBuf>, program_files: Vec<PathBuf>, app_data: PathBuf) -> Forbidden {
        Forbidden { windows, program_files, app_data }
    }

    pub fn from_env(app_data: PathBuf) -> Forbidden {
        let from = |names: &[&str]| names.iter().filter_map(|name| std::env::var_os(name)).map(PathBuf::from).collect::<Vec<_>>();
        Forbidden::new(from(&["SystemRoot", "windir"]), from(&["ProgramFiles", "ProgramFiles(x86)", "ProgramW6432"]), app_data)
    }
}

/// A path as comparable parts: lower case (Windows names ignore capitals), the drive as `c:`, no separators.
fn parts_of(path: &Path) -> Vec<String> {
    path.components()
        .filter_map(|component| match component {
            Component::Prefix(prefix) => {
                let text = prefix.as_os_str().to_string_lossy().to_lowercase();
                Some(text.trim_start_matches("\\\\?\\").to_string())
            }
            Component::RootDir => None,
            other => Some(other.as_os_str().to_string_lossy().to_lowercase()),
        })
        .collect()
}

fn is_inside(path: &[String], base: &[String]) -> bool {
    !base.is_empty() && path.len() >= base.len() && path[..base.len()] == *base
}

fn inside_any(path: &[String], bases: &[PathBuf]) -> bool {
    bases.iter().any(|base| is_inside(path, &parts_of(base)))
}

/// R11: the folder to use for a library the user picked. Refuses a drive root, the Windows folder, Program Files and the app's data folder (and anything in them);
/// creates a missing folder; an empty folder, or one that already holds a library, is used as it is; any other folder gets a `Texturium` subfolder instead.
pub fn choose_library_folder(picked: &Path, forbidden: &Forbidden) -> Result<PathBuf, Refusal> {
    let parts = parts_of(picked);
    if parts.len() <= 1 {
        return Err(Refusal::DriveRoot);
    }
    if inside_any(&parts, &forbidden.windows) {
        return Err(Refusal::WindowsFolder);
    }
    if inside_any(&parts, &forbidden.program_files) {
        return Err(Refusal::ProgramFiles);
    }
    if is_inside(&parts, &parts_of(&forbidden.app_data)) {
        return Err(Refusal::AppDataFolder);
    }
    if !picked.exists() {
        fs::create_dir_all(picked).map_err(|_| Refusal::CannotCreate)?;
        return Ok(picked.to_path_buf());
    }
    if !picked.is_dir() {
        return Err(Refusal::CannotCreate);
    }
    let is_empty = fs::read_dir(picked).map_err(|_| Refusal::CannotCreate)?.next().is_none();
    if is_empty || picked.join(DATABASE_FILE).exists() {
        return Ok(picked.to_path_buf());
    }
    let inner = picked.join(SUBFOLDER);
    fs::create_dir_all(&inner).map_err(|_| Refusal::CannotCreate)?;
    Ok(inner)
}

/// R11: `<home>\Texturium` for the projection app, `<home>\Texturium Materials` for the material app.
pub fn default_library_folder(home: &Path, app_id: &str) -> PathBuf {
    home.join(if app_id == "material" { "Texturium Materials" } else { SUBFOLDER })
}

/// An opened library: its database and files, and the exclusive lock that keeps any other copy of any app out until it is dropped (R14).
pub struct Library {
    pub folder: PathBuf,
    pub db: Db,
    pub files: FileStore,
    _lock: File,
}

pub fn open_library(folder: &Path, app_id: &str) -> CoreResult<Library> {
    if !folder.is_dir() {
        return Err(CoreError::new(ErrorKind::MissingRoot, "The library folder cannot be found."));
    }
    let lock = OpenOptions::new().create(true).write(true).truncate(false).open(folder.join(LOCK_FILE))?;
    match lock.try_lock() {
        Ok(()) => {}
        Err(TryLockError::WouldBlock) => return Err(CoreError::new(ErrorKind::Locked, "This library is in use by another copy of the app.")),
        Err(TryLockError::Error(error)) => return Err(error.into()),
    }
    let db = Db::open(&folder.join(DATABASE_FILE), app_id)?;
    Ok(Library { folder: folder.to_path_buf(), db, files: FileStore::new(folder), _lock: lock })
}

/// `config.json` in the app's data folder: where the library is, remembered between starts (R5).
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct AppConfig {
    pub version: u32,
    #[serde(rename = "libraryPath")]
    pub library_path: String,
}

pub fn load_config(app_data: &Path) -> CoreResult<Option<AppConfig>> {
    match fs::read(app_data.join(CONFIG_FILE)) {
        Ok(bytes) => serde_json::from_slice(&bytes).map(Some).map_err(|_| CoreError::new(ErrorKind::Io, "The saved library location could not be read.")),
        Err(error) if error.kind() == std::io::ErrorKind::NotFound => Ok(None),
        Err(error) => Err(error.into()),
    }
}

pub fn save_config(app_data: &Path, config: &AppConfig) -> CoreResult<()> {
    fs::create_dir_all(app_data)?;
    let mut writer = AtomicWriter::create(app_data.join(CONFIG_FILE), true)?;
    writer.chunk(&serde_json::to_vec(config).map_err(|_| CoreError::new(ErrorKind::Io, "The library location could not be saved."))?)?;
    writer.commit()
}
