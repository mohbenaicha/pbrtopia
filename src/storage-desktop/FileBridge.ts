/** The most bytes that cross to or from disk in one piece (storage-backends R8). */
export const MAX_CHUNK_BYTES = 8 * 1024 * 1024;

/** A file being written: nothing shows at the target until `commit`, which replaces it whole; `abort` leaves no trace. */
export interface FileWriter {
  chunk(bytes: Uint8Array): Promise<void>; // at most MAX_CHUNK_BYTES
  commit(): Promise<void>;
  abort(): Promise<void>;
}

/**
 * The files on the desktop side, under the library folder (storage-backends R8, R12).
 * Paths are `/`-separated and relative, already escaped (`escapeKeyPath`); absolute paths, `..`, illegal parts, device names
 * and the `.tmp` suffix are refused with a `denied` `BridgeError`.
 */
export interface FileBridge {
  /** The file's bytes in chunks of at most MAX_CHUNK_BYTES, or null when there is no such file. */
  read(path: string): Promise<AsyncIterable<Uint8Array> | null>;
  write(path: string): Promise<FileWriter>; // creates the folders
  /** Succeeds when the target is absent; a folder needs `recursive`. */
  remove(path: string, recursive: boolean): Promise<void>;
  /** The entries of one folder (temporary files left out); an empty list when it does not exist. */
  list(path: string): Promise<{ name: string; kind: 'file' | 'dir'; size: number }[]>;
  freeSpace(): Promise<{ free: number; total: number } | null>;
}
