import { beforeAll, describe, expect, it } from 'vitest';
import { createSalt } from '../../../src/keys/crypto/createSalt';
import { deriveKeyFromPassword } from '../../../src/keys/crypto/deriveKeyFromPassword';
import { encryptSecret } from '../../../src/keys/crypto/encryptSecret';
import { checkVerifier, makeVerifier } from '../../../src/keys/crypto/makeVerifier';

let key: CryptoKey;
let wrongKey: CryptoKey;

beforeAll(async () => {
  const salt = createSalt();
  key = await deriveKeyFromPassword('right password', salt, 1000);
  wrongKey = await deriveKeyFromPassword('wrong password', salt, 1000);
});

describe('makeVerifier and checkVerifier', () => {
  it('R2 the verifier accepts the key that made it and rejects any other key', async () => {
    const verifier = await makeVerifier(key);
    expect(await checkVerifier(key, verifier)).toBe(true);
    expect(await checkVerifier(wrongKey, verifier)).toBe(false);
  });

  it('R2 each verifier is sealed with a fresh IV', async () => {
    const first = await makeVerifier(key);
    const second = await makeVerifier(key);
    expect(first.iv).toHaveLength(12);
    expect(second.iv).not.toEqual(first.iv);
  });

  it('R2 a damaged verifier is rejected, not thrown on', async () => {
    const verifier = await makeVerifier(key);
    expect(await checkVerifier(key, { ...verifier, ciphertext: new Uint8Array(4) })).toBe(false);
  });

  it('R2 a sealed provider key cannot stand in for the verifier', async () => {
    const lookalike = await encryptSecret(key, 'texture-lab-keys verifier constant', 'texture-lab-keys/v1/gemini');
    expect(await checkVerifier(key, lookalike)).toBe(false);
  });
});
