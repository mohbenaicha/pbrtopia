import { describe, expect, it, vi } from 'vitest';
import { EnvKeyChoices } from '../../src/keys/env/EnvKeyChoices';
import { KeyVault } from '../../src/keys/KeyVault';
import { ProviderKeySource } from '../../src/keys/ProviderKeySource';
import type { PasswordRequest } from '../../src/keys/vaultTypes';
import { createFakeEnvKeySource, createMemoryEnvChoiceStorage } from './env/fakeEnvKeySource';
import { createMemoryVaultStorage } from './memoryVaultStorage';

const PASSWORD = 'a long enough password';
const GEMINI = 'AIzaSyGEMINI-0123456789-abcdWXYZ';

async function setup(variables: Record<string, string> = {}, options: Parameters<typeof createFakeEnvKeySource>[1] = {}) {
  const request = vi.fn<PasswordRequest>(async () => ({ password: PASSWORD, confirm: PASSWORD }));
  const vault = new KeyVault({ storage: createMemoryVaultStorage(), requestPassword: request, kdfIterations: 1000, channel: null });
  const env = createFakeEnvKeySource(variables, options);
  const choices = new EnvKeyChoices({ storage: createMemoryEnvChoiceStorage(), channel: null });
  const keys = new ProviderKeySource({ vault, choices, env });
  await keys.detectEnvSupport();
  return { vault, env, choices, keys, request };
}

describe('keys ProviderKeySource, vault mode', () => {
  it('R25 behaves as the vault: no key, then a pasted key after unlocking', async () => {
    const { vault, keys } = await setup();
    expect([keys.mode(), keys.hasKey('gemini')]).toEqual(['vault', false]);
    await vault.setKey('gemini', GEMINI);
    expect(keys.hasKey('gemini')).toBe(true);
    expect(await keys.ensureUnlocked()).toEqual({ ok: true, value: undefined });
    expect(await keys.resolveKey('gemini')).toEqual({ ok: true, value: GEMINI });
  });

  it('R25 a locked vault resolves to a failure, not a key', async () => {
    const { vault, keys } = await setup();
    await vault.setKey('gemini', GEMINI);
    vault.lock();
    const result = await keys.resolveKey('gemini');
    expect(result.ok).toBe(false);
  });
});

describe('keys ProviderKeySource, environment mode', () => {
  it('R17 each resolve reads the host again: a changed value is seen and a removed one fails', async () => {
    const { env, choices, keys } = await setup({ GEMINI_API_KEY: 'first-value-123' });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect(await keys.resolveKey('gemini')).toEqual({ ok: true, value: 'first-value-123' });
    env.variables.GEMINI_API_KEY = 'second-value-456';
    expect(await keys.resolveKey('gemini')).toEqual({ ok: true, value: 'second-value-456' });
    delete env.variables.GEMINI_API_KEY;
    const gone = await keys.resolveKey('gemini');
    expect(gone.ok ? null : gone.error.message).toBe('"GEMINI_API_KEY" is not set.');
    expect(env.reads).toHaveLength(3);
  });

  it('R16 R17 the value is trimmed', async () => {
    const { choices, keys } = await setup({ GEMINI_API_KEY: '  padded-key-1  ' });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect(await keys.resolveKey('gemini')).toEqual({ ok: true, value: 'padded-key-1' });
  });

  it('R17 a host that cannot be reached fails with its text', async () => {
    const { choices, keys } = await setup({ GEMINI_API_KEY: 'a-key-value' }, { failReads: true });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    const result = await keys.resolveKey('gemini');
    expect(result.ok ? null : result.error.message).toBe('Could not read the environment.');
  });

  it('R17 the value is not in the stored choices, the console or a failure', async () => {
    const storage = createMemoryEnvChoiceStorage();
    const vault = new KeyVault({ storage: createMemoryVaultStorage(), requestPassword: async () => null, kdfIterations: 1000, channel: null });
    const choices = new EnvKeyChoices({ storage, channel: null });
    const env = createFakeEnvKeySource({ GEMINI_API_KEY: 'TOP-SECRET-VALUE-1' });
    const keys = new ProviderKeySource({ vault, choices, env });
    await keys.detectEnvSupport();
    const spies = (['log', 'info', 'warn', 'error', 'debug'] as const).map((method) => vi.spyOn(console, method).mockImplementation(() => undefined));
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    await keys.resolveKey('gemini');
    expect(JSON.stringify(storage.saved)).not.toContain('TOP-SECRET');
    expect(spies.flatMap((spy) => spy.mock.calls).flat().join(' ')).not.toContain('TOP-SECRET');
    spies.forEach((spy) => spy.mockRestore());
  });

  it('R17 an aborted request does not read', async () => {
    const { env, choices, keys } = await setup({ GEMINI_API_KEY: 'a-key-value' });
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    const controller = new AbortController();
    controller.abort();
    const result = await keys.resolveKey('gemini', controller.signal);
    expect(result.ok).toBe(false);
    expect(env.reads).toEqual([]);
  });

  it('R18 never asks for the password and never touches the vault', async () => {
    const { vault, choices, keys, request } = await setup({ GEMINI_API_KEY: 'a-key-value' });
    const touched = vi.spyOn(vault, 'ensureUnlocked');
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect(await keys.ensureUnlocked()).toEqual({ ok: true, value: undefined });
    await keys.resolveKey('gemini');
    expect(request).not.toHaveBeenCalled();
    expect(touched).not.toHaveBeenCalled();
  });

  it('R18 a provider counts as having a key only with a saved name, and a pasted key is not used', async () => {
    const { vault, choices, keys } = await setup({ GEMINI_API_KEY: 'a-key-value' });
    await vault.setKey('openai', 'sk-proj-OPENAI-0123456789-efghQRST');
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect([keys.mode(), keys.hasKey('gemini'), keys.hasKey('openai')]).toEqual(['env', true, false]);
    const result = await keys.resolveKey('openai');
    expect(result.ok).toBe(false);
  });

  it('R19 turning the switch off uses the pasted key again', async () => {
    const { vault, choices, keys } = await setup({ GEMINI_API_KEY: 'a-key-value' });
    await vault.setKey('gemini', GEMINI);
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    choices.setEnabled(false);
    expect(await keys.resolveKey('gemini')).toEqual({ ok: true, value: GEMINI });
  });

  it('R24 saved on but not offered: no provider has a key and the pasted key is not used', async () => {
    const { vault, choices, keys } = await setup({ GEMINI_API_KEY: 'a-key-value' }, { offered: false });
    await vault.setKey('gemini', GEMINI);
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect([keys.envOffered(), keys.hasKey('gemini')]).toEqual([false, false]);
    expect((await keys.resolveKey('gemini')).ok).toBe(false);
  });

  it('R14 offered only when the host says so, and no host means not offered', async () => {
    expect((await setup({}, { offered: true })).keys.envOffered()).toBe(true);
    expect((await setup({}, { offered: false })).keys.envOffered()).toBe(false);
    const vault = new KeyVault({ storage: createMemoryVaultStorage(), requestPassword: async () => null, kdfIterations: 1000, channel: null });
    const bare = new ProviderKeySource({ vault, choices: new EnvKeyChoices({ storage: createMemoryEnvChoiceStorage(), channel: null }) });
    await bare.detectEnvSupport();
    expect(bare.envOffered()).toBe(false);
  });

  it('R25 announces a change of the switch or a name like a change of the vault', async () => {
    const { choices, keys } = await setup();
    const heard = vi.fn();
    const stop = keys.on('status-changed', heard);
    choices.setEnabled(true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    expect(heard).toHaveBeenCalledTimes(2);
    stop();
  });
});
