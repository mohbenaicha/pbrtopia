import 'fake-indexeddb/auto';
import { IDBFactory } from 'fake-indexeddb';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { vaultScope } from '../../src/appId';
import { KeyVault } from '../../src/keys/KeyVault';
import { createBroadcastVaultChannel } from '../../src/keys/vaultChannel';
import { createIndexedDbVaultStorage } from '../../src/keys/vaultStorage';
import type { PasswordRequest, VaultRecord, VaultStorage } from '../../src/keys/vaultTypes';
import { createMemoryVaultStorage } from './memoryVaultStorage';

const PASSWORD = 'a long enough password';
const request: PasswordRequest = async (purpose) => (purpose === 'create' ? { password: PASSWORD, confirm: PASSWORD } : { password: PASSWORD });
const GEMINI = 'AIzaSyGEMINI-0123456789-abcdWXYZ';
const makeVault = (storage: VaultStorage = createMemoryVaultStorage(), appId?: string) =>
  new KeyVault({ storage, requestPassword: request, kdfIterations: 1000, channel: null, ...(appId === undefined ? {} : { appId }) });

async function databaseNames(factory: IDBFactory): Promise<string[]> {
  return (await factory.databases()).map((entry) => entry.name ?? '').sort();
}

describe('shared/materialgen-prep R8 R9 vault database', () => {
  it('R8 with no appId the vault database is still texture-lab-keys', async () => {
    const factory = new IDBFactory();
    await createIndexedDbVaultStorage(factory).load();
    expect(await databaseNames(factory)).toEqual(['texture-lab-keys']);
  });

  it('R9 with an appId the vault database carries it', async () => {
    const factory = new IDBFactory();
    await createIndexedDbVaultStorage(factory, 'alpha').load();
    expect(await databaseNames(factory)).toEqual(['app-alpha-keys']);
  });

  it('R13 a bad appId throws when the storage or vault is created', () => {
    expect(() => createIndexedDbVaultStorage(new IDBFactory(), 'bad id')).toThrow(/1 to 32 letters, digits or hyphens/);
    expect(() => makeVault(createMemoryVaultStorage(), '9lives')).toThrow(/1 to 32 letters, digits or hyphens/);
  });
});

describe('shared/materialgen-prep R11 vaults are separate', () => {
  it('R11 a key saved under one appId is not listed by another appId over the same database', async () => {
    const factory = new IDBFactory();
    const alpha = makeVault(createIndexedDbVaultStorage(factory, 'alpha'), 'alpha');
    const beta = makeVault(createIndexedDbVaultStorage(factory, 'beta'), 'beta');
    expect((await alpha.setKey('gemini', GEMINI)).ok).toBe(true);
    await beta.refresh();
    expect(alpha.hasKey('gemini')).toBe(true);
    expect(beta.hasKey('gemini')).toBe(false);
    expect(beta.status()).toBe('none');
  });

  it('R11 a vault record copied from another appId does not unlock: the sealed data is bound to the appId', async () => {
    const shared = createMemoryVaultStorage();
    const alpha = makeVault(shared, 'alpha');
    expect((await alpha.setKey('gemini', GEMINI)).ok).toBe(true);
    const beta = makeVault(shared, 'beta');
    await beta.refresh();
    const unlocked = await beta.ensureUnlocked();
    expect(unlocked.ok).toBe(false);
    expect(beta.getKey('gemini')).toBeNull();
  });

  it('R8 a vault with no appId still opens a vault made with no appId', async () => {
    const shared = createMemoryVaultStorage();
    expect((await makeVault(shared).setKey('gemini', GEMINI)).ok).toBe(true);
    const again = makeVault(shared);
    await again.refresh();
    expect((await again.ensureUnlocked()).ok).toBe(true);
    expect(again.getKey('gemini')).toBe(GEMINI);
  });

  it('R11 a change message of one appId does not reach a channel of another', async () => {
    const alpha = createBroadcastVaultChannel(vaultScope('alpha'))!;
    const alphaToo = createBroadcastVaultChannel(vaultScope('alpha'))!;
    const beta = createBroadcastVaultChannel(vaultScope('beta'))!;
    const heardBeta = vi.fn();
    const heardAlpha = vi.fn();
    beta.onChanged(heardBeta);
    alphaToo.onChanged(heardAlpha);
    alpha.postChanged();
    await vi.waitFor(() => expect(heardAlpha).toHaveBeenCalledTimes(1));
    expect(heardBeta).not.toHaveBeenCalled();
    [alpha, alphaToo, beta].forEach((channel) => channel.close());
  });
});

describe('shared/materialgen-prep R8 stored fixtures', () => {
  it('R8 a vault written by the code before this change (tests/fixtures/legacy/vault.json) still unlocks and returns its key', async () => {
    const raw = readFileSync(path.resolve(__dirname, '../fixtures/legacy/vault.json'), 'utf8');
    const record = JSON.parse(raw, (_key, value: unknown) =>
      typeof value === 'object' && value !== null && '__bytes' in value ? new Uint8Array((value as { __bytes: number[] }).__bytes) : value,
    ) as VaultRecord;
    const storage = createMemoryVaultStorage();
    await storage.save(record, null);
    const vault = makeVault(storage);
    await vault.refresh();
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect(vault.getKey('gemini')).toBe(GEMINI);
  });
});
