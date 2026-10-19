import { IV_BYTES, type SealedBytes } from './sealedBytes';

// R2: the secret, or null when the key, the additional data or the bytes are not the ones it was sealed with (a wrong password lands here).
export async function decryptSecret(key: CryptoKey, sealed: SealedBytes, additionalData: string): Promise<string | null> {
  if (sealed.iv.length !== IV_BYTES) return null;
  try {
    const opened = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: sealed.iv as BufferSource, additionalData: new TextEncoder().encode(additionalData) as BufferSource },
      key,
      sealed.ciphertext as BufferSource,
    );
    return new TextDecoder().decode(opened);
  } catch {
    return null;
  }
}
