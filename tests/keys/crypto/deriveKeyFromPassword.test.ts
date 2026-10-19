import { afterEach, describe, expect, it, vi } from 'vitest';
import { createSalt } from '../../../src/keys/crypto/createSalt';
import { decryptSecret } from '../../../src/keys/crypto/decryptSecret';
import { deriveKeyFromPassword } from '../../../src/keys/crypto/deriveKeyFromPassword';
import { encryptSecret } from '../../../src/keys/crypto/encryptSecret';

const ITERATIONS = 1000; // the real 600,000 is timed once in Playwright
const AAD = 'texture-lab-keys/v1/gemini';

afterEach(() => vi.restoreAllMocks());

describe('deriveKeyFromPassword', () => {
  it('R2 the same password, salt and iterations give a key that opens what the other sealed', async () => {
    const salt = createSalt();
    const sealed = await encryptSecret(await deriveKeyFromPassword('correct horse', salt, ITERATIONS), 'secret-key-value', AAD);
    expect(await decryptSecret(await deriveKeyFromPassword('correct horse', salt, ITERATIONS), sealed, AAD)).toBe('secret-key-value');
  });

  it('R2 another password, another salt or another iteration count gives a key that cannot open it', async () => {
    const salt = createSalt();
    const sealed = await encryptSecret(await deriveKeyFromPassword('correct horse', salt, ITERATIONS), 'secret-key-value', AAD);
    expect(await decryptSecret(await deriveKeyFromPassword('wrong horse', salt, ITERATIONS), sealed, AAD)).toBeNull();
    expect(await decryptSecret(await deriveKeyFromPassword('correct horse', createSalt(), ITERATIONS), sealed, AAD)).toBeNull();
    expect(await decryptSecret(await deriveKeyFromPassword('correct horse', salt, ITERATIONS + 1), sealed, AAD)).toBeNull();
  });

  it('R2 the derivation is PBKDF2 with SHA-256 and the given salt and iterations, into a 256-bit AES-GCM key', async () => {
    const salt = createSalt();
    const derive = vi.spyOn(crypto.subtle, 'deriveKey');
    const key = await deriveKeyFromPassword('pw', salt, ITERATIONS);
    const [algorithm, , target] = derive.mock.calls[0]!;
    expect(algorithm).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS });
    expect(new Uint8Array((algorithm as Pbkdf2Params).salt as ArrayBuffer)).toEqual(salt);
    expect(target).toMatchObject({ name: 'AES-GCM', length: 256 });
    expect(key.algorithm).toMatchObject({ name: 'AES-GCM', length: 256 });
  });

  it('R2 the derived key cannot be exported and can only encrypt and decrypt', async () => {
    const key = await deriveKeyFromPassword('pw', createSalt(), ITERATIONS);
    expect(key.extractable).toBe(false);
    expect([...key.usages].sort()).toEqual(['decrypt', 'encrypt']);
    await expect(crypto.subtle.exportKey('raw', key)).rejects.toThrow();
  });

  it('R2 a password with accents or emoji works, and a different spelling of it is a different password', async () => {
    const salt = createSalt();
    const sealed = await encryptSecret(await deriveKeyFromPassword('café 🔑', salt, ITERATIONS), 'secret-key-value', AAD);
    expect(await decryptSecret(await deriveKeyFromPassword('café 🔑', salt, ITERATIONS), sealed, AAD)).toBe('secret-key-value');
    expect(await decryptSecret(await deriveKeyFromPassword('cafe 🔑', salt, ITERATIONS), sealed, AAD)).toBeNull();
  });
});

describe('createSalt', () => {
  it('R2 a salt is 16 random bytes, different each time', () => {
    const first = createSalt();
    expect(first).toBeInstanceOf(Uint8Array);
    expect(first).toHaveLength(16);
    expect(createSalt()).not.toEqual(first);
  });
});
