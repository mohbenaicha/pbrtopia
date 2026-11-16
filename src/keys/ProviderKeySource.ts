import { checkEnvKeyName, type EnvNameCheck } from './env/checkEnvKeyName';
import type { EnvKeyChoices } from './env/EnvKeyChoices';
import type { EnvKeySource } from './env/envKeyTypes';
import { KEY_OK, envNotSetFailure, keyFailure, type KeyResult } from './keyError';
import type { KeyVault } from './KeyVault';
import type { Provider } from './vaultTypes';

interface ProviderKeySourceDeps {
  vault: KeyVault;
  choices: EnvKeyChoices;
  /** The host's environment reader; none = environment keys are not offered (R14). */
  env?: EnvKeySource | undefined;
}

/**
 * Api-keys R17, R18, R24, R25: where a provider's key comes from. With the environment switch off it is the vault's pasted key; with it
 * on, a fresh read of the variable saved for the provider, at the moment a request asks, never kept. The one thing flows ask for a key.
 */
export class ProviderKeySource {
  private readonly vault: KeyVault;
  private readonly choices: EnvKeyChoices;
  private readonly env: EnvKeySource | undefined;
  private offered = false;
  private readonly listeners = new Set<() => void>();

  constructor({ vault, choices, env }: ProviderKeySourceDeps) {
    this.vault = vault;
    this.choices = choices;
    this.env = env;
    vault.on('status-changed', () => this.fire());
    choices.on(() => this.fire());
  }

  /** Asks the host once whether it can read the environment (R14). */
  async detectEnvSupport(): Promise<void> {
    const before = this.offered;
    try {
      this.offered = this.env !== undefined && (await this.env.available());
    } catch {
      this.offered = false;
    }
    if (this.offered !== before) this.fire();
  }

  envOffered(): boolean {
    return this.offered;
  }

  mode(): 'vault' | 'env' {
    return this.choices.enabled() ? 'env' : 'vault';
  }

  hasKey(provider: Provider): boolean {
    if (this.mode() === 'vault') return this.vault.hasKey(provider);
    return this.offered && this.choices.nameOf(provider) !== undefined; // R18, R24
  }

  /** R16, R20: whether `name` can be found now; reads once and drops the value. */
  checkEnvName(name: string): Promise<EnvNameCheck> {
    return this.env === undefined || !this.offered ? Promise.resolve({ status: 'failed', message: 'Could not read the environment.' }) : checkEnvKeyName(this.env, name);
  }

  /** True when a key can be fetched now without asking the user anything: the vault is unlocked, or the environment is offered (R18). */
  isReady(): boolean {
    return this.mode() === 'env' ? this.offered : this.vault.status() === 'unlocked';
  }

  /** R18: with the switch on nothing asks for the password. */
  ensureUnlocked(): ReturnType<KeyVault['ensureUnlocked']> {
    return this.mode() === 'env' ? Promise.resolve(KEY_OK) : this.vault.ensureUnlocked();
  }

  /** R17: the key for one request. In environment mode the host is asked now, so a changed or removed variable is seen at once. */
  async resolveKey(provider: Provider, signal?: AbortSignal): Promise<KeyResult<string>> {
    if (this.mode() === 'vault') {
      const key = this.vault.getKey(provider);
      return key === null ? keyFailure('vault-missing') : { ok: true, value: key };
    }
    const name = this.choices.nameOf(provider);
    if (name === undefined) return keyFailure('env-not-named');
    if (!this.offered || this.env === undefined || signal?.aborted === true) return keyFailure('env-unavailable');
    const answer = await this.env.read(name, signal);
    if (!answer.ok) return answer.reason === 'not-set' ? envNotSetFailure(name) : keyFailure('env-unavailable');
    const value = answer.value.trim();
    return value === '' ? envNotSetFailure(name) : { ok: true, value };
  }

  status(): ReturnType<KeyVault['status']> {
    return this.vault.status();
  }

  on(event: 'status-changed', listener: () => void): () => void {
    if (event !== 'status-changed') return () => undefined;
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private fire(): void {
    this.listeners.forEach((listener) => listener());
  }
}
