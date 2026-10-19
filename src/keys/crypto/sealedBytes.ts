// What an encryption leaves behind: the IV it used and the ciphertext (with its authentication tag).
export interface SealedBytes {
  iv: Uint8Array;
  ciphertext: Uint8Array;
}

export const IV_BYTES = 12;
export const SALT_BYTES = 16;
