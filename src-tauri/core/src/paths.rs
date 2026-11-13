use crate::error::{CoreError, CoreResult, ErrorKind};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};

// Storage-backends R12: the page names files by relative `/`-separated paths; these rules decide which of them reach the disk.
// They are the same rules the TypeScript side escapes keys to (src/storage-desktop/pathEscape.ts), checked again here on purpose.

const ILLEGAL: &[char] = &['<', '>', ':', '"', '|', '?', '*', '\\'];
const DEVICE_NAMES: &[&str] = &["con", "prn", "aux", "nul", "com1", "com2", "com3", "com4", "com5", "com6", "com7", "com8", "com9", "lpt1", "lpt2", "lpt3", "lpt4", "lpt5", "lpt6", "lpt7", "lpt8", "lpt9"];
#[cfg(windows)]
const FILE_ATTRIBUTE_REPARSE_POINT: u32 = 0x400;
#[cfg(windows)]
const LONG_PATH_LIMIT: usize = 240;

fn refuse(message: &str) -> CoreError {
    CoreError::new(ErrorKind::Denied, message)
}

fn is_device_name(part: &str) -> bool {
    let stem = part.split('.').next().unwrap_or("").trim_end().to_ascii_lowercase();
    DEVICE_NAMES.contains(&stem.as_str())
}

fn check_part(part: &str) -> CoreResult<()> {
    if part.is_empty() || part == "." || part == ".." {
        return Err(refuse("That path is not one the library accepts."));
    }
    if part.chars().any(|c| ILLEGAL.contains(&c) || (c as u32) < 0x20) || part.ends_with('.') || part.ends_with(' ') {
        return Err(refuse("That path is not one the library accepts."));
    }
    if is_device_name(part) || part.to_ascii_lowercase().ends_with(".tmp") {
        return Err(refuse("That path is not one the library accepts."));
    }
    Ok(())
}

/// The parts of a safe relative path. An empty path is the root itself, accepted only when `allow_empty`.
pub fn check_relative(rel: &str, allow_empty: bool) -> CoreResult<Vec<&str>> {
    if rel.is_empty() {
        return if allow_empty { Ok(Vec::new()) } else { Err(refuse("That path is not one the library accepts.")) };
    }
    let parts: Vec<&str> = rel.split('/').collect();
    for part in &parts {
        check_part(part)?;
    }
    Ok(parts)
}

/// One safe name that is a single part (an export's file name chosen by the page for a picked folder).
pub fn check_single_name(name: &str) -> CoreResult<()> {
    if name.contains('/') {
        return Err(refuse("That path is not one the library accepts."));
    }
    check_part(name)?;
    Ok(())
}

pub fn is_reparse_point(metadata: &fs::Metadata) -> bool {
    if metadata.file_type().is_symlink() {
        return true;
    }
    #[cfg(windows)]
    {
        use std::os::windows::fs::MetadataExt;
        if metadata.file_attributes() & FILE_ATTRIBUTE_REPARSE_POINT != 0 {
            return true;
        }
    }
    false
}

#[cfg(windows)]
fn with_long_path_prefix(path: PathBuf) -> PathBuf {
    let text = path.to_string_lossy().replace('/', "\\");
    if text.len() >= LONG_PATH_LIMIT && !text.starts_with("\\\\?\\") && !text.starts_with("\\\\") {
        PathBuf::from(format!("\\\\?\\{text}"))
    } else {
        PathBuf::from(text)
    }
}

#[cfg(not(windows))]
fn with_long_path_prefix(path: PathBuf) -> PathBuf {
    path
}

/// The place on disk `rel` names under `root`. The root has to exist (`MissingRoot` otherwise); parts that do not exist yet are fine;
/// a part that exists as a symlink, junction or other reparse point is refused, so nothing leads out of the root.
pub fn resolve(root: &Path, rel: &str, allow_empty: bool) -> CoreResult<PathBuf> {
    let parts = check_relative(rel, allow_empty)?;
    if !root.is_dir() {
        return Err(CoreError::new(ErrorKind::MissingRoot, "The library folder cannot be found."));
    }
    let mut current = root.to_path_buf();
    let mut checking = true;
    for part in parts {
        current.push(part);
        if !checking {
            continue;
        }
        match fs::symlink_metadata(&current) {
            Ok(metadata) if is_reparse_point(&metadata) => return Err(refuse("That path is not one the library accepts.")),
            Ok(_) => {}
            Err(error) if error.kind() == io::ErrorKind::NotFound => checking = false,
            Err(error) => return Err(error.into()),
        }
    }
    Ok(with_long_path_prefix(current))
}
