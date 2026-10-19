import { describe, expect, it } from 'vitest';
import type { VaultStorage } from '../../src/keys/vaultTypes';
import { sampleVaultRecord } from './vaultFixtures';

// The checks every VaultStorage must pass (R2, R5, R10); run on the in-memory stand-in and on the IndexedDB one.
export function describeVaultStorageContract(name: string, make: () => VaultStorage): void {
  describe(`${name}: vault storage contract`, () => {
    it('R2 an empty storage has no vault', async () => {
      expect(await make().load()).toBeNull();
    });

    it('R2 a vault saved with no earlier revision is loaded back exactly, bytes included', async () => {
      const storage = make();
      const record = sampleVaultRecord({ revision: 1 });
      expect(await storage.save(record, null)).toBe('saved');
      expect(await storage.load()).toEqual(record);
    });

    it('R10 a save that expects no vault is refused when one exists, and writes nothing', async () => {
      const storage = make();
      await storage.save(sampleVaultRecord({ revision: 1 }), null);
      expect(await storage.save(sampleVaultRecord({ revision: 1, keys: {} }), null)).toBe('conflict');
      expect((await storage.load())?.keys.gemini?.hint).toBe('abcd');
    });

    it('R10 a save based on the stored revision is kept, and the next one must be based on the new revision', async () => {
      const storage = make();
      await storage.save(sampleVaultRecord({ revision: 1 }), null);
      expect(await storage.save(sampleVaultRecord({ revision: 2, keys: {} }), 1)).toBe('saved');
      expect((await storage.load())?.revision).toBe(2);
      expect(await storage.save(sampleVaultRecord({ revision: 3 }), 1)).toBe('conflict');
      expect((await storage.load())?.revision).toBe(2);
    });

    it('R10 a save based on a revision when nothing is stored (the vault was wiped meanwhile) is refused', async () => {
      const storage = make();
      expect(await storage.save(sampleVaultRecord({ revision: 2 }), 1)).toBe('conflict');
      expect(await storage.load()).toBeNull();
    });

    it('R10 a save with a different salt is refused even when the revision matches, and writes nothing', async () => {
      const storage = make();
      const first = sampleVaultRecord({ revision: 1 });
      await storage.save(first, null);
      const otherSalt = sampleVaultRecord({ revision: 2, kdf: { ...first.kdf, salt: new Uint8Array(16).fill(9) } });
      expect(await storage.save(otherSalt, 1)).toBe('conflict');
      expect(await storage.load()).toEqual(first);
    });

    it('R10 two saves at once on the same revision: one is kept, the other is refused', async () => {
      const storage = make();
      await storage.save(sampleVaultRecord({ revision: 1 }), null);
      const results = await Promise.all([storage.save(sampleVaultRecord({ revision: 2, keys: {} }), 1), storage.save(sampleVaultRecord({ revision: 2 }), 1)]);
      expect([...results].sort()).toEqual(['conflict', 'saved']);
    });

    it('R6 clear removes the vault, is harmless when there is none, and a new vault can be saved after it', async () => {
      const storage = make();
      await storage.clear();
      await storage.save(sampleVaultRecord({ revision: 1 }), null);
      await storage.clear();
      expect(await storage.load()).toBeNull();
      expect(await storage.save(sampleVaultRecord({ revision: 1 }), null)).toBe('saved');
    });

    it('R2 changing a loaded record does not change what is stored', async () => {
      const storage = make();
      await storage.save(sampleVaultRecord({ revision: 1 }), null);
      const loaded = (await storage.load())!;
      loaded.kdf.salt[0] = 255;
      delete loaded.keys.gemini;
      expect(await storage.load()).toEqual(sampleVaultRecord({ revision: 1 }));
    });
  });
}
