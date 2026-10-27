export type ViewportErrorCode = 'unsupported-compression' | 'not-glb' | 'parse-failed' | 'webgl-unavailable' | 'export-failed' | 'picture-unreadable';

interface ViewportError {
  code: ViewportErrorCode;
  message: string; // plain words for the person using the app
}

export type ViewportResult<T> = { ok: true; value: T } | { ok: false; error: ViewportError };
