import { PROVIDERS, type Provider } from '../vaultTypes';

/** Api-keys R19: whether environment keys are used and the variable name per provider. Names are not secrets; no key is ever here. */
export interface EnvChoices {
  enabled: boolean;
  names: Partial<Record<Provider, string>>;
}

export interface EnvChoiceStorage {
  load(): EnvChoices | null;
  save(choices: EnvChoices): void;
}

/** Keeps only a boolean and non-empty names, whatever was stored. */
export function readEnvChoices(raw: unknown): EnvChoices | null {
  if (typeof raw !== 'object' || raw === null) return null;
  const record = raw as { enabled?: unknown; names?: unknown };
  const names: EnvChoices['names'] = {};
  if (typeof record.names === 'object' && record.names !== null) {
    for (const provider of PROVIDERS) {
      const name = (record.names as Record<string, unknown>)[provider];
      if (typeof name === 'string' && name.trim() !== '') names[provider] = name;
    }
  }
  return { enabled: record.enabled === true, names };
}

/** The choices in the browser's local storage (the webview's in the desktop app), named `<appId>-key-sources`; blocked site data reads as nothing. */
export function createLocalEnvChoiceStorage(appId: string = 'texture-lab'): EnvChoiceStorage {
  const key = `${appId}-key-sources`;
  return {
    load() {
      try {
        const text = window.localStorage.getItem(key);
        return text === null ? null : readEnvChoices(JSON.parse(text));
      } catch {
        return null;
      }
    },
    save(choices) {
      try {
        window.localStorage.setItem(key, JSON.stringify(choices));
      } catch {
        // blocked site data: the choice lasts until the page closes
      }
    },
  };
}
