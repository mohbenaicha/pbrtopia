// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest';
import { EnvKeyChoices } from '../../../src/keys/env/EnvKeyChoices';
import { createLocalEnvChoiceStorage } from '../../../src/keys/env/envChoiceStorage';
import type { VaultChannel } from '../../../src/keys/vaultChannel';
import { createMemoryEnvChoiceStorage } from './fakeEnvKeySource';

function createBus() {
  const listeners = new Set<{ owner: object; listener: () => void }>();
  return {
    channelFor: (owner: object): VaultChannel => ({
      postChanged: () => listeners.forEach((entry) => entry.owner !== owner && entry.listener()),
      onChanged: (listener) => {
        const entry = { owner, listener };
        listeners.add(entry);
        return () => listeners.delete(entry);
      },
      close: () => undefined,
    }),
  };
}

describe('keys/env EnvKeyChoices', () => {
  it('R13 starts off with no names', () => {
    const choices = new EnvKeyChoices({ storage: createMemoryEnvChoiceStorage(), channel: null });
    expect([choices.enabled(), choices.nameOf('gemini'), choices.nameOf('openai')]).toEqual([false, undefined, undefined]);
  });

  it('R13 R19 the switch is saved when set and remembered by the next instance', () => {
    const storage = createMemoryEnvChoiceStorage();
    new EnvKeyChoices({ storage, channel: null }).setEnabled(true);
    expect(new EnvKeyChoices({ storage, channel: null }).enabled()).toBe(true);
  });

  it('R19 a name is saved per provider, replaced, and forgotten by clear; the switch is untouched by it', () => {
    const storage = createMemoryEnvChoiceStorage();
    const choices = new EnvKeyChoices({ storage, channel: null });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    choices.setName('openai', 'OPENAI_API_KEY');
    choices.setName('gemini', 'MY_GEMINI_KEY');
    expect(storage.saved).toEqual({ enabled: true, names: { gemini: 'MY_GEMINI_KEY', openai: 'OPENAI_API_KEY' } });
    choices.clearName('gemini');
    expect(storage.saved).toEqual({ enabled: true, names: { openai: 'OPENAI_API_KEY' } });
  });

  it('R19 turning the switch off keeps the names for later', () => {
    const choices = new EnvKeyChoices({ storage: createMemoryEnvChoiceStorage(), channel: null });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    choices.setEnabled(false);
    expect([choices.enabled(), choices.nameOf('gemini')]).toEqual([false, 'GEMINI_API_KEY']);
  });

  it('R19 a listener hears each change once', () => {
    const choices = new EnvKeyChoices({ storage: createMemoryEnvChoiceStorage(), channel: null });
    const listener = vi.fn();
    const stop = choices.on(listener);
    choices.setEnabled(true);
    choices.setName('openai', 'OPENAI_API_KEY');
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
    choices.clearName('openai');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('R19 R10 another tab reloads the names when this one changes them', () => {
    const storage = createMemoryEnvChoiceStorage();
    const bus = createBus();
    const first = new EnvKeyChoices({ storage, channel: bus.channelFor({}) });
    const second = new EnvKeyChoices({ storage, channel: bus.channelFor({}) });
    const heard = vi.fn();
    second.on(heard);
    first.setEnabled(true);
    first.setName('gemini', 'GEMINI_API_KEY');
    expect([second.enabled(), second.nameOf('gemini')]).toEqual([true, 'GEMINI_API_KEY']);
    expect(heard).toHaveBeenCalled();
  });

  it('R19 an unreadable stored value is ignored and starts clean', () => {
    const storage = createMemoryEnvChoiceStorage({ enabled: 'yes', names: { gemini: 5, openai: '  ' } } as never);
    const choices = new EnvKeyChoices({ storage, channel: null });
    expect([choices.enabled(), choices.nameOf('gemini'), choices.nameOf('openai')]).toEqual([false, undefined, undefined]);
  });
});

describe('keys/env envChoiceStorage', () => {
  it('R19 is kept under <appId>-key-sources in local storage and never in the vault database', () => {
    window.localStorage.clear();
    const storage = createLocalEnvChoiceStorage('pbrtopia');
    storage.save({ enabled: true, names: { gemini: 'GEMINI_API_KEY' } });
    expect(Object.keys(window.localStorage)).toEqual(['pbrtopia-key-sources']);
    expect(storage.load()).toEqual({ enabled: true, names: { gemini: 'GEMINI_API_KEY' } });
  });

  it('R19 two app ids never share it', () => {
    window.localStorage.clear();
    createLocalEnvChoiceStorage('pbrtopia').save({ enabled: true, names: {} });
    expect(createLocalEnvChoiceStorage('texturium').load()).toBeNull();
  });

  it('R19 blocked site data reads as nothing and saving does not throw', () => {
    const blocked = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const failing = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new Error('blocked');
    });
    const storage = createLocalEnvChoiceStorage('pbrtopia');
    expect(storage.load()).toBeNull();
    expect(() => storage.save({ enabled: true, names: {} })).not.toThrow();
    blocked.mockRestore();
    failing.mockRestore();
  });
});
