import type { EnvKeySource, EnvReadResult } from '../../../src/keys/env/envKeyTypes';
import type { EnvChoices, EnvChoiceStorage } from '../../../src/keys/env/envChoiceStorage';

/** A host that holds the given variables, counts every read and can say it is not offered. */
export function createFakeEnvKeySource(variables: Record<string, string> = {}, options: { offered?: boolean; needsRestart?: boolean; failReads?: boolean } = {}) {
  const reads: string[] = [];
  const source: EnvKeySource & { variables: Record<string, string>; reads: string[] } = {
    variables,
    reads,
    needsRestart: options.needsRestart ?? false,
    available: async () => options.offered ?? true,
    read: async (name): Promise<EnvReadResult> => {
      reads.push(name);
      if (options.failReads === true) return { ok: false, reason: 'unavailable' };
      const value = variables[name];
      return value === undefined || value === '' ? { ok: false, reason: 'not-set' } : { ok: true, value };
    },
  };
  return source;
}

/** The choice store held in memory; `saved` is what a reload would read. */
export function createMemoryEnvChoiceStorage(initial: EnvChoices | null = null): EnvChoiceStorage & { saved: EnvChoices | null } {
  const storage = {
    saved: initial,
    load: () => storage.saved,
    save: (choices: EnvChoices) => {
      storage.saved = { enabled: choices.enabled, names: { ...choices.names } };
    },
  };
  return storage;
}
