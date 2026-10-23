import { describe, expect, it } from 'vitest';
import { readVaultRecord } from '../../src/keys/readVaultRecord';
import { MAX_KDF_ITERATIONS, type VaultRecord } from '../../src/keys/vaultTypes';
import { sampleVaultRecord } from './vaultFixtures';

type Loose = Record<string, unknown>;
const looseSample = (): Loose => sampleVaultRecord() as unknown as Loose;
const withKdf = (changes: Loose): Loose => ({ ...looseSample(), kdf: { ...(looseSample()['kdf'] as Loose), ...changes } });
const withKey = (provider: string, changes: Loose): Loose => {
  const keys = looseSample()['keys'] as Record<string, Loose>;
  return { ...looseSample(), keys: { ...keys, [provider]: { ...keys[provider], ...changes } } };
};

describe('readVaultRecord', () => {
  it('api-keys R2 a stored vault with both keys reads back equal', () => {
    expect(readVaultRecord(sampleVaultRecord())).toEqual(sampleVaultRecord());
  });

  it('api-keys R2 a vault with one key, or none, is whole', () => {
    const gemini = sampleVaultRecord();
    delete gemini.keys.openai;
    expect(readVaultRecord(gemini)).toEqual(gemini);
    expect(readVaultRecord(sampleVaultRecord({ keys: {} }))?.keys).toEqual({});
  });

  it('api-keys R2 only the data model\'s fields are kept: unknown fields and keys of an unknown provider are dropped', () => {
    const raw: Loose = { ...looseSample(), extra: 1, plainKey: 'AIza-whole-key' };
    (raw['keys'] as Loose)['claude'] = { iv: new Uint8Array(12), ciphertext: new Uint8Array(20), hint: 'zzzz', addedAt: 'x' };
    (raw['keys'] as Record<string, Loose>)['gemini']!['password'] = 'hunter22';
    const record = readVaultRecord(raw);
    expect(record).toEqual(sampleVaultRecord());
    expect(record).not.toHaveProperty('extra');
    expect(record?.keys).not.toHaveProperty('claude');
    expect(record?.keys.gemini).not.toHaveProperty('password');
  });

  it('api-keys R2 the bytes are copied, so changing the stored record afterwards does not change what was read', () => {
    const stored = sampleVaultRecord();
    const record = readVaultRecord(stored) as VaultRecord;
    stored.kdf.salt[0] = 99;
    stored.verifier.ciphertext[0] = 99;
    stored.keys.gemini!.ciphertext[0] = 99;
    expect(record.kdf.salt[0]).not.toBe(99);
    expect(record.verifier.ciphertext[0]).not.toBe(99);
    expect(record.keys.gemini!.ciphertext[0]).not.toBe(99);
  });

  it('api-keys R2 anything that is not an object, or is an array, is not a vault', () => {
    for (const raw of [null, undefined, 'vault', 7, [], [sampleVaultRecord()]]) expect(readVaultRecord(raw)).toBeNull();
  });

  it('api-keys R2 a record of another version is unreadable', () => {
    for (const version of [0, 2, '1', undefined]) expect(readVaultRecord({ ...looseSample(), version }), String(version)).toBeNull();
  });

  it('api-keys R10 the revision must be a whole number of 1 or more', () => {
    for (const revision of [0, -1, 1.5, Number.NaN, Number.MAX_SAFE_INTEGER + 2, '3', undefined]) expect(readVaultRecord({ ...looseSample(), revision }), String(revision)).toBeNull();
    expect(readVaultRecord({ ...looseSample(), revision: 1 })?.revision).toBe(1);
  });

  it('api-keys R2 the key derivation must be PBKDF2 with SHA-256', () => {
    expect(readVaultRecord(withKdf({ name: 'scrypt' }))).toBeNull();
    expect(readVaultRecord(withKdf({ hash: 'SHA-1' }))).toBeNull();
    expect(readVaultRecord({ ...looseSample(), kdf: 'PBKDF2' })).toBeNull();
    expect(readVaultRecord({ ...looseSample(), kdf: undefined })).toBeNull();
  });

  it('api-keys R2 the iteration count is a whole number from 1 up to the limit, which a stored record may not exceed', () => {
    for (const iterations of [0, -5, 1.5, Number.NaN, MAX_KDF_ITERATIONS + 1, '1000', undefined]) expect(readVaultRecord(withKdf({ iterations })), String(iterations)).toBeNull();
    expect(readVaultRecord(withKdf({ iterations: 1 }))?.kdf.iterations).toBe(1);
    expect(readVaultRecord(withKdf({ iterations: MAX_KDF_ITERATIONS }))?.kdf.iterations).toBe(MAX_KDF_ITERATIONS);
  });

  it('api-keys R2 the salt must be 16 bytes of a byte array', () => {
    for (const salt of [new Uint8Array(15), new Uint8Array(17), new Uint8Array(0), Array.from({ length: 16 }, () => 1), 'a'.repeat(16), undefined]) {
      expect(readVaultRecord(withKdf({ salt })), String(salt)).toBeNull();
    }
  });

  it('api-keys R5 the verifier must have a 12-byte IV and a byte-array ciphertext', () => {
    const verifier = looseSample()['verifier'] as Loose;
    for (const bad of [{ ...verifier, iv: new Uint8Array(11) }, { ...verifier, iv: new Uint8Array(13) }, { ...verifier, iv: [1, 2, 3] }, { ...verifier, ciphertext: 'abc' }, { iv: verifier['iv'] }, null, 'verifier', undefined]) {
      expect(readVaultRecord({ ...looseSample(), verifier: bad })).toBeNull();
    }
  });

  it('api-keys R2 the keys part must be an object, not an array or a missing value', () => {
    for (const keys of [[], null, 'keys', undefined]) expect(readVaultRecord({ ...looseSample(), keys }), String(keys)).toBeNull();
  });

  it('api-keys R7 a stored key that is not whole makes the whole vault unreadable instead of silently dropping the key', () => {
    expect(readVaultRecord(withKey('gemini', { iv: new Uint8Array(5) }))).toBeNull();
    expect(readVaultRecord(withKey('gemini', { ciphertext: [1, 2] }))).toBeNull();
    expect(readVaultRecord(withKey('openai', { hint: 1234 }))).toBeNull();
    expect(readVaultRecord(withKey('openai', { addedAt: undefined }))).toBeNull();
    expect(readVaultRecord({ ...looseSample(), keys: { gemini: 'secret' } })).toBeNull();
    expect(readVaultRecord({ ...looseSample(), keys: { gemini: null } })).toBeNull();
  });

  it('api-keys R7 a key entry that is simply absent is fine, even beside a present one', () => {
    const record = readVaultRecord({ ...looseSample(), keys: { gemini: (looseSample()['keys'] as Record<string, unknown>)['gemini'], openai: undefined } });
    expect(Object.keys(record?.keys ?? {})).toEqual(['gemini']);
  });
});
