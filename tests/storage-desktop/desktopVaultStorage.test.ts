import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { createDesktopVaultStorage } from '../../src/storage-desktop/desktopVaultStorage';
import { createNodeFileBridge } from '../support/storageDesktop/nodeFileBridge';
import { sampleVaultRecord } from '../keys/vaultFixtures';

let root: string;
beforeEach(async () => void (root = await mkdtemp(join(tmpdir(), 'desktop-vault-'))));
afterEach(async () => rm(root, { recursive: true, force: true }));

const open = () => createDesktopVaultStorage(createNodeFileBridge(root));

describe('desktop VaultStorage (storage-backends R4, R5)', () => {
  it('R5 no file means no vault; a saved vault loads back with every byte field equal', async () => {
    const storage = open();
    expect(await storage.load()).toBeNull();
    expect(await storage.save(sampleVaultRecord(), null)).toBe('saved');
    expect(await storage.load()).toEqual(sampleVaultRecord());
  });

  it('R5 vault.json holds a version and the record with every byte field as base64 text, never as numbers or a library file', async () => {
    await open().save(sampleVaultRecord(), null);
    const file = JSON.parse(await readFile(join(root, 'vault.json'), 'utf8')) as { version: number; record: { kdf: { salt: unknown }; verifier: { iv: unknown; ciphertext: unknown }; keys: { gemini: { ciphertext: unknown; hint: string } } } };
    expect(file.version).toBe(1);
    expect(file.record.kdf.salt).toBe(Buffer.from(sampleVaultRecord().kdf.salt).toString('base64'));
    expect(typeof file.record.verifier.iv).toBe('string');
    expect(typeof file.record.verifier.ciphertext).toBe('string');
    expect(typeof file.record.keys.gemini.ciphertext).toBe('string');
    expect(file.record.keys.gemini.hint).toBe('abcd');
  });

  it('R4 save is compare-and-write: a stale revision, a different salt, or a vault created by someone else gives "conflict" and writes nothing', async () => {
    const storage = open();
    await storage.save(sampleVaultRecord({ revision: 1 }), null);
    expect(await storage.save(sampleVaultRecord({ revision: 2 }), null)).toBe('conflict'); // expected no vault, there is one
    expect(await storage.save(sampleVaultRecord({ revision: 5 }), 4)).toBe('conflict'); // based on a revision that is not stored
    const otherSalt = sampleVaultRecord({ revision: 2 });
    otherSalt.kdf.salt = new Uint8Array(16).fill(9);
    expect(await storage.save(otherSalt, 1)).toBe('conflict'); // the vault was recreated
    expect((await storage.load())?.revision).toBe(1);
    expect(await storage.save(sampleVaultRecord({ revision: 2 }), 1)).toBe('saved');
    expect((await storage.load())?.revision).toBe(2);
  });

  it('R4 two saves started together on the same revision: one is saved and the other gets "conflict"', async () => {
    const storage = open();
    await storage.save(sampleVaultRecord({ revision: 1 }), null);
    const results = await Promise.all([storage.save(sampleVaultRecord({ revision: 2 }), 1), storage.save(sampleVaultRecord({ revision: 2 }), 1)]);
    expect([...results].sort()).toEqual(['conflict', 'saved']);
  });

  it('R4 a vault file that cannot be read makes load fail with fixed words, is never replaced as if absent, and clear removes it', async () => {
    await writeFile(join(root, 'vault.json'), 'not json at all');
    const storage = open();
    await expect(storage.load()).rejects.toThrow('The key vault could not be read.');
    expect(await storage.save(sampleVaultRecord(), null)).toBe('conflict'); // an unreadable file is still somebody's vault
    expect(await storage.save(sampleVaultRecord(), 1)).toBe('conflict');
    await storage.clear();
    expect(await storage.load()).toBeNull();
    await storage.clear(); // clearing nothing is fine
  });

  it('R4 a file with bad base64 or a wrong version is unreadable, not a half record', async () => {
    const good = JSON.parse((await (async () => { await open().save(sampleVaultRecord(), null); return readFile(join(root, 'vault.json'), 'utf8'); })())) as { version: number; record: { kdf: { salt: string } } };
    good.record.kdf.salt = '!!not base64!!';
    await writeFile(join(root, 'vault.json'), JSON.stringify(good));
    await expect(open().load()).rejects.toThrow('The key vault could not be read.');
    await writeFile(join(root, 'vault.json'), JSON.stringify({ ...good, version: 99 }));
    await expect(open().load()).rejects.toThrow('The key vault could not be read.');
  });
});
