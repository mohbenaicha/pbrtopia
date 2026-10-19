import { IV_BYTES, type SealedBytes } from './sealedBytes';

// R2: AES-GCM with a fresh random IV every time. `additionalData` is bound to the ciphertext, so it only opens under the same text.
export async function encryptSecret(key: CryptoKey, secret: string, additionalData: string): Promise<SealedBytes> {
  const iv = crypto.getRandomValues(new Uint8Array(IV_BYTES));
  const encrypted = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv: iv as BufferSource, additionalData: new TextEncoder().encode(additionalData) as BufferSource },
    key,
    new TextEncoder().encode(secret) as BufferSource,
  );
  return { iv, ciphertext: new Uint8Array(encrypted) };
}
