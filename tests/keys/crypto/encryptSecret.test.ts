import { beforeAll, describe, expect, it } from 'vitest';
import { createSalt } from '../../../src/keys/crypto/createSalt';
import { decryptSecret } from '../../../src/keys/crypto/decryptSecret';
import { deriveKeyFromPassword } from '../../../src/keys/crypto/deriveKeyFromPassword';
import { encryptSecret } from '../../../src/keys/crypto/encryptSecret';

const AAD = 'texture-lab-keys/v1/gemini';
let key: CryptoKey;
let otherKey: CryptoKey;

beforeAll(async () => {
  key = await deriveKeyFromPassword('one', createSalt(), 1000);
  otherKey = await deriveKeyFromPassword('two', createSalt(), 1000);
});

describe('encryptSecret and decryptSecret', () => {
  it('R2 a secret comes back unchanged, including accents and long text', async () => {
    for (const secret of ['AIzaSyA-0123456789abcdef', 'clé-ü-🔑', 'x'.repeat(5000)]) {
      expect(await decryptSecret(key, await encryptSecret(key, secret, AAD), AAD)).toBe(secret);
    }
  });

  it('R2 every encryption uses a fresh 12-byte IV, so the same secret seals differently each time', async () => {
    const first = await encryptSecret(key, 'same-secret-value', AAD);
    const second = await encryptSecret(key, 'same-secret-value', AAD);
    expect(first.iv).toHaveLength(12);
    expect(second.iv).not.toEqual(first.iv);
    expect(second.ciphertext).not.toEqual(first.ciphertext);
  });

  it('R2 the sealed bytes do not contain the secret as text', async () => {
    const sealed = await encryptSecret(key, 'plain-secret-value', AAD);
    expect(new TextDecoder('latin1').decode(sealed.ciphertext)).not.toContain('plain-secret-value');
  });

  it('R2 a different key, different additional data, a changed ciphertext or a changed IV opens nothing', async () => {
    const sealed = await encryptSecret(key, 'secret-key-value', AAD);
    expect(await decryptSecret(otherKey, sealed, AAD)).toBeNull();
    expect(await decryptSecret(key, sealed, 'texture-lab-keys/v1/openai')).toBeNull();
    const flipped = new Uint8Array(sealed.ciphertext);
    flipped[0] = flipped[0]! ^ 1;
    expect(await decryptSecret(key, { ...sealed, ciphertext: flipped }, AAD)).toBeNull();
    const otherIv = new Uint8Array(sealed.iv);
    otherIv[0] = otherIv[0]! ^ 1;
    expect(await decryptSecret(key, { ...sealed, iv: otherIv }, AAD)).toBeNull();
  });

  it('R2 sealed bytes that are too short or empty open nothing instead of throwing', async () => {
    expect(await decryptSecret(key, { iv: new Uint8Array(12), ciphertext: new Uint8Array(0) }, AAD)).toBeNull();
    expect(await decryptSecret(key, { iv: new Uint8Array(3), ciphertext: new Uint8Array(30) }, AAD)).toBeNull();
  });
});
