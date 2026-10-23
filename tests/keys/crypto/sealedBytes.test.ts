import { describe, expect, it } from 'vitest';
import { createSalt } from '../../../src/keys/crypto/createSalt';
import { deriveKeyFromPassword } from '../../../src/keys/crypto/deriveKeyFromPassword';
import { encryptSecret } from '../../../src/keys/crypto/encryptSecret';
import { IV_BYTES, SALT_BYTES, type SealedBytes } from '../../../src/keys/crypto/sealedBytes';

describe('sealed byte sizes', () => {
  it('api-keys R2 an IV is 12 bytes and a salt is 16 bytes, the sizes AES-GCM and the vault format use', () => {
    expect(IV_BYTES).toBe(12);
    expect(SALT_BYTES).toBe(16);
  });

  it('api-keys R2 a new salt has exactly the salt size and is different each time', () => {
    const first = createSalt();
    expect(first).toHaveLength(SALT_BYTES);
    expect(createSalt()).not.toEqual(first);
  });

  it('api-keys R2 an encryption leaves an IV of exactly the IV size beside a longer ciphertext that carries the authentication tag', async () => {
    const key = await deriveKeyFromPassword('password-1', createSalt(), 1000);
    const sealed: SealedBytes = await encryptSecret(key, 'AIzaSyA-0123456789', 'texture-lab-keys/v1/gemini');
    expect(sealed.iv).toHaveLength(IV_BYTES);
    expect(sealed.ciphertext.length).toBe('AIzaSyA-0123456789'.length + 16);
  });
});
