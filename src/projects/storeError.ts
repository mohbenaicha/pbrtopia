export type StoreErrorCode = 'not-found' | 'quota-exceeded' | 'locked-by-other-tab' | 'schema-too-new' | 'corrupt' | 'storage-unavailable' | 'aborted';

export interface StoreError {
  code: StoreErrorCode;
  message: string; // plain words for the person using the app
}

// Storage calls report expected failures this way instead of throwing (specs/app/projects/contracts.md).
export type StoreResult<T> = { ok: true; value: T } | { ok: false; error: StoreError };

export const storeFailure = (code: StoreErrorCode, message: string): { ok: false; error: StoreError } => ({ ok: false, error: { code, message } });
