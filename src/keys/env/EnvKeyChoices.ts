import type { VaultChannel } from '../vaultChannel';
import type { Provider } from '../vaultTypes';
import { readEnvChoices, type EnvChoices, type EnvChoiceStorage } from './envChoiceStorage';

interface EnvKeyChoicesDeps {
  storage: EnvChoiceStorage;
  /** How other tabs are told (R19, R10); none = this tab alone. */
  channel: VaultChannel | null;
}

/** Api-keys R13, R19: the switch and the variable names, kept through `storage`. A change is saved at once, announced to listeners and to other tabs. */
export class EnvKeyChoices {
  private readonly storage: EnvChoiceStorage;
  private readonly channel: VaultChannel | null;
  private current: EnvChoices;
  private readonly listeners = new Set<() => void>();

  constructor({ storage, channel }: EnvKeyChoicesDeps) {
    this.storage = storage;
    this.channel = channel;
    this.current = readEnvChoices(storage.load()) ?? { enabled: false, names: {} };
    channel?.onChanged(() => this.reload());
  }

  enabled(): boolean {
    return this.current.enabled;
  }

  nameOf(provider: Provider): string | undefined {
    return this.current.names[provider];
  }

  setEnabled(enabled: boolean): void {
    this.change({ ...this.current, enabled });
  }

  setName(provider: Provider, name: string): void {
    this.change({ ...this.current, names: { ...this.current.names, [provider]: name } });
  }

  clearName(provider: Provider): void {
    const names = { ...this.current.names };
    delete names[provider];
    this.change({ ...this.current, names });
  }

  on(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  private change(next: EnvChoices): void {
    this.current = next;
    this.storage.save(next);
    this.channel?.postChanged();
    this.fire();
  }

  private reload(): void {
    this.current = readEnvChoices(this.storage.load()) ?? { enabled: false, names: {} };
    this.fire();
  }

  private fire(): void {
    this.listeners.forEach((listener) => listener());
  }
}
