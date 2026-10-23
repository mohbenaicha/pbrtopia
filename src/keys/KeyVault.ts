import { createSalt } from './crypto/createSalt';
import { decryptSecret } from './crypto/decryptSecret';
import { deriveKeyFromPassword } from './crypto/deriveKeyFromPassword';
import { encryptSecret } from './crypto/encryptSecret';
import { checkVerifier, makeVerifier } from './crypto/makeVerifier';
import { KEY_OK, keyFailure, type KeyResult } from './keyError';
import { createBroadcastVaultChannel, type VaultChannel } from './vaultChannel';
import { PROVIDERS, VAULT_VERSION, type PasswordRequest, type Provider, type SealedKey, type VaultRecord, type VaultStorage } from './vaultTypes';

const DEFAULT_KDF_ITERATIONS =600_000;
export const MIN_PASSWORD_LENGTH = 8;
const MIN_KEY_LENGTH =8;
const HINT_LENGTH = 4;

interface KeyVaultDeps {
  storage: VaultStorage;
  requestPassword: PasswordRequest;
  kdfIterations?: number; // only used when a vault is created; unlock uses the iterations stored in the record
  channel?: VaultChannel | null; // how other tabs are told; left out = BroadcastChannel when the browser has it, null = none
}

interface UnlockedSession {
  cryptoKey: CryptoKey;
  keys: Partial<Record<Provider, string>>;
  revision: number; // the stored revision and salt these keys were read from: another value means another vault
  salt: Uint8Array;
}

const isProvider = (value: unknown): value is Provider => (PROVIDERS as readonly unknown[]).includes(value);
const hasWebCrypto = (): boolean => typeof crypto !== 'undefined' && crypto.subtle !== undefined;
const additionalDataFor = (provider: Provider): string => `texture-lab-keys/v1/${provider}`;
const sameBytes = (a: Uint8Array, b: Uint8Array): boolean => a.length === b.length && a.every((value, i) => value === b[i]);

// R1-R3, R5-R7, R10, R12: the only holder of decrypted keys. A key is returned by getKey and nowhere else; nothing here logs or
// raises an error that contains a key or a password. Changes to the vault are done one after the other.
export class KeyVault {
  private readonly storage: VaultStorage;
  private readonly requestPassword: PasswordRequest;
  private readonly kdfIterations: number;
  private readonly channel: VaultChannel | null;
  private record: VaultRecord | null = null;
  private loaded = false;
  private unreadable: string | null = null; // why the last read of the stored vault failed
  private wipes = 0; // counts the steps of a wipe; a read that started before one ended is out of date
  private session: UnlockedSession | null = null;
  private unlocking: Promise<KeyResult<void>> | undefined;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly listeners = new Set<() => void>();

  constructor(deps: KeyVaultDeps) {
    this.storage = deps.storage;
    this.requestPassword = deps.requestPassword;
    this.kdfIterations = deps.kdfIterations ?? DEFAULT_KDF_ITERATIONS;
    this.channel = deps.channel === undefined ? createBroadcastVaultChannel() : deps.channel;
    this.channel?.onChanged(() => void this.onOtherTabChanged());
  }

  status(): 'none' | 'locked' | 'unlocked' {
    if (this.session) return 'unlocked';
    return this.record ? 'locked' : 'none';
  }

  hasKey(provider: Provider): boolean {
    return this.record?.keys[provider] !== undefined;
  }

  // The last 4 characters of the stored key, readable while locked.
  hint(provider: Provider): string | null {
    return this.record?.keys[provider]?.hint ?? null;
  }

  // R6: the fixed message when the stored vault could not be read (so the UI can offer a reset), otherwise null.
  loadProblem(): string | null {
    return this.unreadable;
  }

  getKey(provider: Provider): string | null {
    return this.session?.keys[provider] ?? null;
  }

  on(event: 'status-changed', listener: () => void): () => void {
    if (event !== 'status-changed') return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  // Reads the stored vault (at startup, or to see another tab's change) and tells the listeners.
  async refresh(): Promise<KeyResult<void>> {
    const loaded = await this.loadRecord();
    this.fire();
    return loaded;
  }

  // R3: asks for the password when the vault is locked; callers at the same time share one prompt.
  ensureUnlocked(): Promise<KeyResult<void>> {
    if (!hasWebCrypto()) return Promise.resolve(keyFailure('crypto-unavailable'));
    if (this.session) return Promise.resolve(KEY_OK);
    this.unlocking ??= this.unlockWithPrompt().finally(() => {
      this.unlocking = undefined;
    });
    return this.unlocking;
  }

  // R1, R7: adds or replaces a key. The first key creates the vault and asks for a new password; a locked vault asks to unlock first.
  setKey(provider: Provider, key: string): Promise<KeyResult<void>> {
    return this.enqueue(async () => {
      const trimmed = typeof key === 'string' ? key.trim() : '';
      if (!isProvider(provider) || trimmed.length < MIN_KEY_LENGTH) return keyFailure('invalid-key');
      if (!hasWebCrypto()) return keyFailure('crypto-unavailable');
      const read = await this.loadOnce();
      if (!read.ok) return read;
      if (this.record === null) return this.createVault(provider, trimmed);
      const unlocked = await this.ensureUnlocked();
      if (!unlocked.ok) return unlocked;
      return this.saveKeys(provider, trimmed);
    });
  }

  // R7: removes one provider's key. Removing the last one keeps the vault and its password.
  removeKey(provider: Provider): Promise<KeyResult<void>> {
    return this.enqueue(async () => {
      if (!isProvider(provider)) return keyFailure('invalid-key');
      if (!hasWebCrypto()) return keyFailure('crypto-unavailable');
      const read = await this.loadOnce();
      if (!read.ok) return read;
      if (this.record?.keys[provider] === undefined) return KEY_OK;
      const unlocked = await this.ensureUnlocked();
      if (!unlocked.ok) return unlocked;
      return this.saveKeys(provider, null);
    });
  }

  // R12: drops the decrypted keys and the derived key.
  lock(): void {
    if (!this.session) return;
    this.session = null;
    this.fire();
  }

  // R6: deletes the stored vault (the caller has asked the user first). Rejects with the storage's fixed message if it cannot be deleted.
  wipe(): Promise<void> {
    return this.enqueue(async () => {
      this.wipes += 1;
      await this.storage.clear();
      this.wipes += 1;
      this.record = null;
      this.loaded = true;
      this.unreadable = null;
      this.session = null;
      this.channel?.postChanged();
      this.fire();
    });
  }

  private enqueue<T>(work: () => Promise<T>): Promise<T> {
    const run = this.queue.then(work, work);
    this.queue = run.catch(() => undefined);
    return run;
  }

  private fire(): void {
    for (const listener of [...this.listeners]) listener();
  }

  private async onOtherTabChanged(): Promise<void> {
    this.session = null;
    await this.refresh();
  }

  private async loadOnce(): Promise<KeyResult<void>> {
    return this.loaded ? KEY_OK : this.loadRecord();
  }

  // Reads the stored record. Keys in memory are dropped when the stored vault is no longer the one they came from.
  // A read that was running when a wipe happened describes the vault as it was, so its answer is dropped.
  private async loadRecord(): Promise<KeyResult<void>> {
    const wipesBefore = this.wipes;
    let stored: VaultRecord | null;
    try {
      stored = await this.storage.load();
    } catch {
      if (this.wipes !== wipesBefore) return KEY_OK;
      this.unreadable = keyFailure('storage-failed').error.message;
      return keyFailure('storage-failed');
    }
    if (this.wipes !== wipesBefore) return KEY_OK;
    this.unreadable = null;
    const session = this.session;
    if (session && (stored === null || stored.revision !== session.revision || !sameBytes(stored.kdf.salt, session.salt))) this.session = null;
    this.record = stored;
    this.loaded = true;
    return KEY_OK;
  }

  private async unlockWithPrompt(): Promise<KeyResult<void>> {
    const read = await this.loadOnce();
    if (!read.ok) return read;
    const record = this.record;
    if (this.session) return KEY_OK;
    if (!record) return keyFailure('vault-missing');
    const answer = await this.requestPassword('unlock');
    if (!answer) return keyFailure('password-cancelled');
    try {
      const cryptoKey = await deriveKeyFromPassword(answer.password, record.kdf.salt, record.kdf.iterations);
      if (!(await checkVerifier(cryptoKey, record.verifier))) return keyFailure('wrong-password');
      const keys: Partial<Record<Provider, string>> = {};
      for (const provider of PROVIDERS) {
        const sealed = record.keys[provider];
        const opened = sealed ? await decryptSecret(cryptoKey, sealed, additionalDataFor(provider)) : null;
        if (opened !== null) keys[provider] = opened; // a key that does not open (swapped or damaged) is left out
      }
      // Another tab may have changed the vault while the password was being typed: these keys then belong to an old record.
      const now = this.record;
      if (!now || now.revision !== record.revision || !sameBytes(now.kdf.salt, record.kdf.salt)) return keyFailure('vault-changed');
      this.session = { cryptoKey, keys, revision: record.revision, salt: record.kdf.salt };
    } catch {
      return keyFailure('crypto-unavailable');
    }
    this.fire();
    return KEY_OK;
  }

  private async createVault(provider: Provider, plain: string): Promise<KeyResult<void>> {
    const answer = await this.requestPassword('create');
    if (!answer) return keyFailure('password-cancelled');
    if (answer.password.length < MIN_PASSWORD_LENGTH) return keyFailure('weak-password');
    if (answer.confirm !== answer.password) return keyFailure('password-mismatch');
    let record: VaultRecord;
    let cryptoKey: CryptoKey;
    try {
      const salt = createSalt();
      cryptoKey = await deriveKeyFromPassword(answer.password, salt, this.kdfIterations);
      record = {
        version: VAULT_VERSION,
        revision: 1,
        kdf: { name: 'PBKDF2', hash: 'SHA-256', iterations: this.kdfIterations, salt },
        verifier: await makeVerifier(cryptoKey),
        keys: { [provider]: await this.sealKey(cryptoKey, provider, plain) },
      };
    } catch {
      return keyFailure('crypto-unavailable');
    }
    const saved = await this.save(record, null);
    if (!saved.ok) return saved;
    this.record = record;
    this.session = { cryptoKey, keys: { [provider]: plain }, revision: 1, salt: record.kdf.salt };
    this.channel?.postChanged();
    this.fire();
    return KEY_OK;
  }

  // Adds, replaces (plain is the key) or removes (null) one key in an unlocked vault. Memory changes only after the save went through.
  private async saveKeys(provider: Provider, plain: string | null): Promise<KeyResult<void>> {
    const session = this.session;
    const record = this.record;
    if (!session || !record) return keyFailure('vault-changed');
    const keys = { ...record.keys };
    try {
      if (plain === null) delete keys[provider];
      else keys[provider] = await this.sealKey(session.cryptoKey, provider, plain);
    } catch {
      return keyFailure('crypto-unavailable');
    }
    const next: VaultRecord = { ...record, revision: record.revision + 1, keys };
    const saved = await this.save(next, record.revision);
    if (!saved.ok) return saved;
    // The save went through, but the vault may have been locked, or another tab may have changed it, while it was running:
    // then the session is not brought back, and a newer record already read stays.
    if (!this.record || this.record.revision <= record.revision) this.record = next;
    if (this.session === session) {
      const memory = { ...session.keys };
      if (plain === null) delete memory[provider];
      else memory[provider] = plain;
      this.session = { ...session, keys: memory, revision: next.revision };
    }
    this.channel?.postChanged();
    this.fire();
    return KEY_OK;
  }

  private async sealKey(cryptoKey: CryptoKey, provider: Provider, plain: string): Promise<SealedKey> {
    return { ...(await encryptSecret(cryptoKey, plain, additionalDataFor(provider))), hint: plain.slice(-HINT_LENGTH), addedAt: new Date().toISOString() };
  }

  // R10: a refused save writes nothing; this tab locks and reads the vault again.
  private async save(record: VaultRecord, basedOnRevision: number | null): Promise<KeyResult<void>> {
    let outcome: 'saved' | 'conflict';
    try {
      outcome = await this.storage.save(record, basedOnRevision);
    } catch {
      return keyFailure('storage-failed');
    }
    if (outcome === 'saved') return KEY_OK;
    this.session = null;
    await this.loadRecord();
    this.fire();
    return keyFailure('vault-changed');
  }
}
