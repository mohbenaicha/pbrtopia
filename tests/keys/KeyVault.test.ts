import { afterEach, describe, expect, it, vi } from 'vitest';
import { KeyVault } from '../../src/keys/KeyVault';
import type { VaultChannel } from '../../src/keys/vaultChannel';
import type { PasswordAnswer, PasswordRequest, VaultStorage } from '../../src/keys/vaultTypes';
import { createMemoryVaultStorage } from './memoryVaultStorage';

afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const PASSWORD = 'a long enough password';
const GEMINI = 'AIzaSyGEMINI-0123456789-abcdWXYZ';
const OPENAI = 'sk-proj-OPENAI-0123456789-efghQRST';
const ITERATIONS = 1000;

// Several vaults on one storage hear each other through one in-memory bus, as tabs do through BroadcastChannel.
function createBus() {
  const listeners = new Set<{ owner: object; listener: () => void }>();
  return {
    channelFor(owner: object): VaultChannel {
      return {
        postChanged: () => listeners.forEach((entry) => entry.owner !== owner && entry.listener()),
        onChanged: (listener) => {
          const entry = { owner, listener };
          listeners.add(entry);
          return () => listeners.delete(entry);
        },
        close: () => undefined,
      };
    },
  };
}

interface Setup {
  vault: KeyVault;
  storage: ReturnType<typeof createMemoryVaultStorage>;
  request: ReturnType<typeof vi.fn<PasswordRequest>>;
  answers: (PasswordAnswer | null)[];
}

function setup(options: { storage?: ReturnType<typeof createMemoryVaultStorage>; bus?: ReturnType<typeof createBus>; kdfIterations?: number; answers?: (PasswordAnswer | null)[]; gate?: Promise<void> } = {}): Setup {
  const storage = options.storage ?? createMemoryVaultStorage();
  const answers = options.answers ?? [];
  const request = vi.fn<PasswordRequest>(async (purpose) => {
    await options.gate; // the user is still typing until the gate opens
    const next = answers.shift();
    if (next !== undefined) return next;
    return purpose === 'create' ? { password: PASSWORD, confirm: PASSWORD } : { password: PASSWORD };
  });
  const owner = {};
  const vault = new KeyVault({ storage, requestPassword: request, kdfIterations: options.kdfIterations ?? ITERATIONS, channel: options.bus ? options.bus.channelFor(owner) : null });
  return { vault, storage, request, answers };
}

async function vaultWith(...providers: ('gemini' | 'openai')[]): Promise<Setup> {
  const made = setup();
  for (const provider of providers) await made.vault.setKey(provider, provider === 'gemini' ? GEMINI : OPENAI);
  return made;
}

const failureCode = (result: { ok: boolean; error?: { code: string } }): string | undefined => (result.ok ? undefined : result.error?.code);

describe('KeyVault: keys and providers', () => {
  it('R1 two providers can each hold a key, and getKey returns each one', async () => {
    const { vault } = await vaultWith('gemini', 'openai');
    expect(vault.getKey('gemini')).toBe(GEMINI);
    expect(vault.getKey('openai')).toBe(OPENAI);
    expect(vault.hasKey('gemini') && vault.hasKey('openai')).toBe(true);
  });

  it('R1 an unknown provider is rejected without asking for a password', async () => {
    const { vault, request } = setup();
    expect(failureCode(await vault.setKey('claude' as never, GEMINI))).toBe('invalid-key');
    expect(request).not.toHaveBeenCalled();
    expect(vault.status()).toBe('none');
  });

  it('R7 a key is trimmed; empty, whitespace-only and shorter than 8 characters are invalid-key and ask for nothing', async () => {
    const { vault, request } = setup();
    for (const bad of ['', '   ', 'abcdefg', '  abcdefg  ']) expect(failureCode(await vault.setKey('gemini', bad)), JSON.stringify(bad)).toBe('invalid-key');
    expect(request).not.toHaveBeenCalled();
    await vault.setKey('gemini', `  ${GEMINI}\n`);
    expect(vault.getKey('gemini')).toBe(GEMINI);
  });
});

describe('KeyVault: what is stored', () => {
  it('R2 the stored record has exactly the data-model fields, the hint is the last 4 characters, and nothing readable of the key or password', async () => {
    const { storage } = await vaultWith('gemini');
    const record = storage.peek()!;
    expect(Object.keys(record).sort()).toEqual(['kdf', 'keys', 'revision', 'verifier', 'version']);
    expect(Object.keys(record.kdf).sort()).toEqual(['hash', 'iterations', 'name', 'salt']);
    expect(record.kdf).toMatchObject({ name: 'PBKDF2', hash: 'SHA-256', iterations: ITERATIONS });
    expect(record.kdf.salt).toHaveLength(16);
    expect(record.revision).toBe(1);
    expect(Object.keys(record.keys)).toEqual(['gemini']);
    expect(Object.keys(record.keys.gemini!).sort()).toEqual(['addedAt', 'ciphertext', 'hint', 'iv']);
    expect(record.keys.gemini!.hint).toBe(GEMINI.slice(-4));
    expect(Number.isNaN(Date.parse(record.keys.gemini!.addedAt))).toBe(false);
    const text = JSON.stringify(record, (_, value: unknown) => (value instanceof Uint8Array ? Array.from(value) : value));
    expect(text).not.toContain(GEMINI.slice(0, 20));
    expect(text).not.toContain(PASSWORD);
  });

  it('R2 replacing a key seals it again with a new IV and raises the revision; the salt stays', async () => {
    const { vault, storage } = await vaultWith('gemini');
    const before = storage.peek()!;
    await vault.setKey('gemini', 'AIzaSy-replacement-key-0000-ZZZZ');
    const after = storage.peek()!;
    expect(after.revision).toBe(before.revision + 1);
    expect(after.keys.gemini!.iv).not.toEqual(before.keys.gemini!.iv);
    expect(after.keys.gemini!.hint).toBe('ZZZZ');
    expect(after.kdf.salt).toEqual(before.kdf.salt);
  });

  it('R2 sealed keys swapped between providers in storage are not accepted as the other provider\'s key', async () => {
    const { storage } = await vaultWith('gemini', 'openai');
    const record = storage.peek()!;
    await storage.clear();
    await storage.save({ ...record, keys: { gemini: record.keys.openai!, openai: record.keys.gemini! } }, null);
    const { vault } = setup({ storage });
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect(vault.getKey('gemini')).toBeNull();
    expect(vault.getKey('openai')).toBeNull();
  });

  it('R2 unlock uses the iterations stored in the record, whatever the constructor was given', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault } = setup({ storage, kdfIterations: 5 });
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect(vault.getKey('gemini')).toBe(GEMINI);
  });
});

describe('KeyVault: passwords (R3, R5)', () => {
  it('R3 the first key asks for a new password with its confirmation, once', async () => {
    const { vault, request } = setup();
    await vault.setKey('gemini', GEMINI);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('create');
    expect(vault.status()).toBe('unlocked');
  });

  it('R3 a confirmation that differs is password-mismatch and nothing is stored', async () => {
    const { vault, storage } = setup({ answers: [{ password: PASSWORD, confirm: `${PASSWORD}!` }] });
    expect(failureCode(await vault.setKey('gemini', GEMINI))).toBe('password-mismatch');
    expect(storage.peek()).toBeNull();
    expect(vault.status()).toBe('none');
  });

  it('R3 a missing confirmation is also password-mismatch', async () => {
    const { vault } = setup({ answers: [{ password: PASSWORD }] });
    expect(failureCode(await vault.setKey('gemini', GEMINI))).toBe('password-mismatch');
  });

  it('R3 a password under 8 characters is weak-password and nothing is stored', async () => {
    const { vault, storage } = setup({ answers: [{ password: 'short', confirm: 'short' }] });
    expect(failureCode(await vault.setKey('gemini', GEMINI))).toBe('weak-password');
    expect(storage.peek()).toBeNull();
  });

  it('R3 cancelling the new-password dialog is password-cancelled and nothing is stored', async () => {
    const { vault, storage } = setup({ answers: [null] });
    expect(failureCode(await vault.setKey('gemini', GEMINI))).toBe('password-cancelled');
    expect(storage.peek()).toBeNull();
  });

  it('R3 a locked vault asks once when a key is needed, and a second need in the same session does not ask again', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault, request } = setup({ storage });
    await vault.refresh();
    expect(vault.status()).toBe('locked');
    expect(vault.getKey('gemini')).toBeNull();
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('unlock');
    expect(vault.getKey('gemini')).toBe(GEMINI);
  });

  it('R3 two ensureUnlocked calls at once share one prompt', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault, request } = setup({ storage });
    const results = await Promise.all([vault.ensureUnlocked(), vault.ensureUnlocked()]);
    expect(results.every((result) => result.ok)).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
  });

  it('R3 pasting a key while unlocked does not ask for the password', async () => {
    const { vault, request } = await vaultWith('gemini');
    request.mockClear();
    await vault.setKey('openai', OPENAI);
    expect(request).not.toHaveBeenCalled();
  });

  it('R3 pasting a key into a locked vault asks to unlock first', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault, request } = setup({ storage });
    await vault.refresh();
    expect((await vault.setKey('openai', OPENAI)).ok).toBe(true);
    expect(request).toHaveBeenCalledTimes(1);
    expect(request).toHaveBeenCalledWith('unlock');
    expect(vault.getKey('gemini')).toBe(GEMINI);
    expect(vault.getKey('openai')).toBe(OPENAI);
  });

  it('R3 cancelling the unlock dialog is password-cancelled and the vault stays locked', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault } = setup({ storage, answers: [null] });
    expect(failureCode(await vault.ensureUnlocked())).toBe('password-cancelled');
    expect(vault.status()).toBe('locked');
  });

  it('R3 ensureUnlocked with no vault at all is vault-missing and asks for nothing', async () => {
    const { vault, request } = setup();
    expect(failureCode(await vault.ensureUnlocked())).toBe('vault-missing');
    expect(request).not.toHaveBeenCalled();
  });

  it('R5 a wrong password is wrong-password, the stored bytes are unchanged and the keys stay locked', async () => {
    const { storage } = await vaultWith('gemini', 'openai');
    const before = storage.peek();
    const { vault } = setup({ storage, answers: [{ password: 'not the password' }] });
    expect(failureCode(await vault.ensureUnlocked())).toBe('wrong-password');
    expect(storage.peek()).toEqual(before);
    expect(vault.status()).toBe('locked');
    expect(vault.getKey('gemini')).toBeNull();
  });

  it('R5 setKey into a locked vault with a wrong password stores nothing', async () => {
    const { storage } = await vaultWith('gemini');
    const before = storage.peek();
    const { vault } = setup({ storage, answers: [{ password: 'not the password' }] });
    expect(failureCode(await vault.setKey('openai', OPENAI))).toBe('wrong-password');
    expect(storage.peek()).toEqual(before);
  });
});

describe('KeyVault: remove, lock, wipe (R6, R7, R12)', () => {
  it('R7 removing a key deletes only that provider\'s key and keeps the password', async () => {
    const { vault, storage } = await vaultWith('gemini', 'openai');
    expect((await vault.removeKey('gemini')).ok).toBe(true);
    expect(vault.hasKey('gemini')).toBe(false);
    expect(vault.getKey('gemini')).toBeNull();
    expect(vault.getKey('openai')).toBe(OPENAI);
    expect(Object.keys(storage.peek()!.keys)).toEqual(['openai']);
  });

  it('R7 removing the last key keeps the vault, so the same password still unlocks it', async () => {
    const { vault, storage, request } = await vaultWith('gemini');
    await vault.removeKey('gemini');
    expect(storage.peek()).not.toBeNull();
    expect(Object.keys(storage.peek()!.keys)).toEqual([]);
    vault.lock();
    request.mockClear();
    expect((await vault.ensureUnlocked()).ok).toBe(true);
    expect(request).toHaveBeenCalledWith('unlock');
  });

  it('R7 removing a key that is not there is not an error', async () => {
    const { vault, storage } = await vaultWith('gemini');
    const before = storage.peek();
    expect((await vault.removeKey('openai')).ok).toBe(true);
    expect(storage.peek()).toEqual(before);
  });

  it('R7 a save that fails is storage-failed and the keys in memory are as they were', async () => {
    const real = createMemoryVaultStorage();
    const { vault } = setup({ storage: real });
    await vault.setKey('gemini', GEMINI);
    const failing: VaultStorage = { load: () => real.load(), clear: () => real.clear(), save: () => Promise.reject(new Error('disk full')) };
    const { vault: other } = setup({ storage: Object.assign(failing, { peek: real.peek }) });
    await other.ensureUnlocked();
    expect(failureCode(await other.setKey('gemini', 'AIzaSy-replacement-key-0000-ZZZZ'))).toBe('storage-failed');
    expect(other.getKey('gemini')).toBe(GEMINI);
    expect(failureCode(await other.setKey('openai', OPENAI))).toBe('storage-failed');
    expect(other.hasKey('openai')).toBe(false);
    expect(failureCode(await other.removeKey('gemini'))).toBe('storage-failed');
    expect(other.getKey('gemini')).toBe(GEMINI);
  });

  it('R7 a vault that cannot be read is storage-failed', async () => {
    const storage = Object.assign({ load: () => Promise.reject(new Error('boom')), save: () => Promise.resolve('saved' as const), clear: () => Promise.resolve() }, { peek: () => null });
    const { vault } = setup({ storage });
    expect(failureCode(await vault.ensureUnlocked())).toBe('storage-failed');
    expect(failureCode(await vault.setKey('gemini', GEMINI))).toBe('storage-failed');
  });

  it('R12 lock drops the keys: getKey is null, status is locked, and the next setKey asks for the password', async () => {
    const { vault, request } = await vaultWith('gemini');
    vault.lock();
    expect(vault.status()).toBe('locked');
    expect(vault.getKey('gemini')).toBeNull();
    expect(vault.hasKey('gemini')).toBe(true);
    expect(vault.hint('gemini')).toBe(GEMINI.slice(-4));
    request.mockClear();
    await vault.setKey('openai', OPENAI);
    expect(request).toHaveBeenCalledWith('unlock');
  });

  it('R6 wipe deletes the vault and the keys, and a new key can be entered with a new password', async () => {
    const { vault, storage, request } = await vaultWith('gemini');
    await vault.wipe();
    expect(storage.peek()).toBeNull();
    expect(vault.status()).toBe('none');
    expect(vault.hasKey('gemini')).toBe(false);
    expect(vault.getKey('gemini')).toBeNull();
    request.mockClear();
    const otherPassword = 'a completely different password';
    request.mockResolvedValueOnce({ password: otherPassword, confirm: otherPassword });
    expect((await vault.setKey('openai', OPENAI)).ok).toBe(true);
    expect(request).toHaveBeenCalledWith('create');
    expect(storage.peek()!.revision).toBe(1);
  });
});

describe('KeyVault: status events (R7, R10)', () => {
  it('R7 status-changed fires on create, lock, unlock and wipe, and stops after unsubscribe', async () => {
    const { vault } = setup();
    const heard = vi.fn();
    const stop = vault.on('status-changed', heard);
    await vault.setKey('gemini', GEMINI);
    const afterCreate = heard.mock.calls.length;
    expect(afterCreate).toBeGreaterThan(0);
    vault.lock();
    const afterLock = heard.mock.calls.length;
    expect(afterLock).toBeGreaterThan(afterCreate);
    await vault.ensureUnlocked();
    const afterUnlock = heard.mock.calls.length;
    expect(afterUnlock).toBeGreaterThan(afterLock);
    await vault.wipe();
    expect(heard.mock.calls.length).toBeGreaterThan(afterUnlock);
    stop();
    const total = heard.mock.calls.length;
    await vault.setKey('gemini', GEMINI);
    expect(heard).toHaveBeenCalledTimes(total);
  });

  it('R12 lock on a vault that is already locked fires nothing', async () => {
    const { vault } = await vaultWith('gemini');
    vault.lock();
    const heard = vi.fn();
    vault.on('status-changed', heard);
    vault.lock();
    expect(heard).not.toHaveBeenCalled();
  });

  it('R7 refresh reads a vault from an earlier session: locked, with its hints', async () => {
    const { storage } = await vaultWith('gemini');
    const { vault } = setup({ storage });
    const heard = vi.fn();
    vault.on('status-changed', heard);
    await vault.refresh();
    expect(vault.status()).toBe('locked');
    expect(vault.hint('gemini')).toBe(GEMINI.slice(-4));
    expect(vault.hint('openai')).toBeNull();
    expect(heard).toHaveBeenCalled();
  });
});

describe('KeyVault: two tabs (R10)', () => {
  it('R10 a save based on an old revision is vault-changed, writes nothing, and the stale vault locks', async () => {
    const storage = createMemoryVaultStorage();
    const first = setup({ storage });
    await first.vault.setKey('gemini', GEMINI);
    const second = setup({ storage });
    await second.vault.ensureUnlocked();
    await first.vault.setKey('openai', OPENAI); // the first tab changes the vault
    const before = storage.peek();
    expect(failureCode(await second.vault.setKey('gemini', 'AIzaSy-replacement-key-0000-ZZZZ'))).toBe('vault-changed');
    expect(storage.peek()).toEqual(before);
    expect(second.vault.status()).toBe('locked');
    expect(second.vault.getKey('gemini')).toBeNull();
    expect(second.vault.hasKey('openai')).toBe(true); // the record was read again
  });

  it('R10 a save into a vault another tab wiped is vault-changed', async () => {
    const storage = createMemoryVaultStorage();
    const first = setup({ storage });
    await first.vault.setKey('gemini', GEMINI);
    const second = setup({ storage });
    await second.vault.ensureUnlocked();
    await first.vault.wipe();
    expect(failureCode(await second.vault.setKey('openai', OPENAI))).toBe('vault-changed');
    expect(storage.peek()).toBeNull();
    expect(second.vault.status()).toBe('none');
  });

  it('R10 a first key created in two tabs at once: one is kept, the other is vault-changed', async () => {
    const storage = createMemoryVaultStorage();
    const first = setup({ storage });
    const second = setup({ storage });
    const results = await Promise.all([first.vault.setKey('gemini', GEMINI), second.vault.setKey('openai', OPENAI)]);
    expect(results.map((result) => (result.ok ? 'ok' : result.error.code)).sort()).toEqual(['ok', 'vault-changed']);
  });

  it('R10 when another tab changes the vault, this tab locks and tells its listeners', async () => {
    const storage = createMemoryVaultStorage();
    const bus = createBus();
    const first = setup({ storage, bus });
    const second = setup({ storage, bus });
    await first.vault.setKey('gemini', GEMINI);
    await second.vault.ensureUnlocked();
    expect(second.vault.status()).toBe('unlocked');
    const heard = vi.fn();
    second.vault.on('status-changed', heard);
    await first.vault.setKey('openai', OPENAI);
    await vi.waitFor(() => expect(second.vault.status()).toBe('locked'));
    expect(second.vault.getKey('gemini')).toBeNull();
    await vi.waitFor(() => expect(second.vault.hasKey('openai')).toBe(true));
    expect(heard).toHaveBeenCalled();
  });

  it('R10 a change made by another tab while the password prompt is open ends the unlock as vault-changed and installs nothing', async () => {
    const storage = createMemoryVaultStorage();
    const bus = createBus();
    const first = setup({ storage, bus });
    await first.vault.setKey('gemini', GEMINI);
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const second = setup({ storage, bus, gate });
    const unlocking = second.vault.ensureUnlocked();
    await vi.waitFor(() => expect(second.request).toHaveBeenCalled());
    await first.vault.setKey('openai', OPENAI);
    await vi.waitFor(() => expect(second.vault.hasKey('openai')).toBe(true));
    release();
    expect(failureCode(await unlocking)).toBe('vault-changed');
    expect(second.vault.status()).toBe('locked');
    expect(second.vault.getKey('gemini')).toBeNull();
  });

  it('R12 locking while a save is in flight keeps the vault locked when the save finishes, and the saved key is in the record', async () => {
    const { vault, storage } = await vaultWith('gemini');
    let release!: () => void;
    const gate = new Promise<void>((resolve) => (release = resolve));
    const realSave = storage.save.bind(storage);
    vi.spyOn(storage, 'save').mockImplementation(async (record, basedOnRevision) => {
      await gate;
      return realSave(record, basedOnRevision);
    });
    const saving = vault.setKey('openai', OPENAI);
    await vi.waitFor(() => expect(storage.save).toHaveBeenCalled());
    vault.lock();
    release();
    expect((await saving).ok).toBe(true);
    expect(vault.status()).toBe('locked');
    expect(vault.getKey('gemini')).toBeNull();
    expect(vault.getKey('openai')).toBeNull();
    expect(vault.hint('openai')).toBe('QRST');
  });

  it('R10 a wipe in one tab makes the other tab forget the vault', async () => {
    const storage = createMemoryVaultStorage();
    const bus = createBus();
    const first = setup({ storage, bus });
    const second = setup({ storage, bus });
    await first.vault.setKey('gemini', GEMINI);
    await second.vault.refresh();
    await first.vault.wipe();
    await vi.waitFor(() => expect(second.vault.status()).toBe('none'));
    expect(second.vault.hasKey('gemini')).toBe(false);
  });
});

describe('KeyVault: default key derivation (R2)', () => {
  it('R2 a vault created without a chosen iteration count stores at least 600,000 PBKDF2 iterations', async () => {
    const storage = createMemoryVaultStorage();
    const vault = new KeyVault({ storage, requestPassword: async () => ({ password: PASSWORD, confirm: PASSWORD }), channel: null });
    expect((await vault.setKey('gemini', GEMINI)).ok).toBe(true);
    expect(storage.peek()?.kdf.iterations).toBeGreaterThanOrEqual(600_000);
  }, 30_000);
});

describe('KeyVault: nothing leaks (R4)', () => {
  it('R4 the key comes out only through getKey: not in console output, not in errors, not in stored bytes', async () => {
    const logged: string[] = [];
    for (const method of ['log', 'info', 'warn', 'error', 'debug'] as const) vi.spyOn(console, method).mockImplementation((...args: unknown[]) => void logged.push(args.map(String).join(' ')));
    const { vault, storage } = setup({ answers: [{ password: PASSWORD, confirm: 'different password' }] });
    const failed = await vault.setKey('gemini', GEMINI); // mismatch error
    await vault.setKey('gemini', GEMINI);
    const rejected = await vault.setKey('openai', 'short');
    vault.lock();
    const wrong = setup({ storage, answers: [{ password: 'not the password' }] });
    const wrongResult = await wrong.vault.ensureUnlocked();
    for (const result of [failed, rejected, wrongResult]) {
      expect(result.ok).toBe(false);
      if (!result.ok) {
        expect(JSON.stringify(result)).not.toContain(GEMINI.slice(0, 12));
        expect(JSON.stringify(result)).not.toContain(PASSWORD);
      }
    }
    expect(logged.join('\n')).not.toContain(GEMINI.slice(0, 12));
    expect(logged.join('\n')).not.toContain(PASSWORD);
    expect(JSON.stringify(Object.keys(vault))).not.toContain('AIza');
  });

  it('R4 every error message is a fixed text, the same whatever the key or password was', async () => {
    const messages = new Set<string>();
    for (const key of ['short1', 'short2']) {
      const { vault } = setup();
      const result = await vault.setKey('gemini', key);
      if (!result.ok) messages.add(result.error.message);
    }
    expect(messages.size).toBe(1);
  });
});

describe('KeyVault: no Web Crypto', () => {
  it('crypto-unavailable is returned, with no password prompt and no fallback, when crypto.subtle is missing', async () => {
    const { storage } = await vaultWith('gemini');
    vi.stubGlobal('crypto', {});
    const { vault, request } = setup({ storage });
    expect(failureCode(await vault.setKey('openai', OPENAI))).toBe('crypto-unavailable');
    expect(failureCode(await vault.ensureUnlocked())).toBe('crypto-unavailable');
    expect(failureCode(await vault.removeKey('gemini'))).toBe('crypto-unavailable');
    expect(request).not.toHaveBeenCalled();
  });
});
