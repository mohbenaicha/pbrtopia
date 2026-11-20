// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { EnvKeyChoices } from '../../../src/keys/env/EnvKeyChoices';
import { KeyVault } from '../../../src/keys/KeyVault';
import { ProviderKeySource } from '../../../src/keys/ProviderKeySource';
import { KeySettingsSection } from '../../../src/keys/ui/KeySettingsSection';
import { usePasswordPrompt } from '../../../src/keys/ui/usePasswordPrompt';
import { createFakeEnvKeySource, createMemoryEnvChoiceStorage } from '../env/fakeEnvKeySource';
import { createMemoryVaultStorage } from '../memoryVaultStorage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const row = (name: 'Gemini' | 'OpenAI' | 'OpenRouter') => within(screen.getByRole('group', { name }));
const switchRow = () => screen.queryByRole('switch', { name: 'Read keys from environment' });

async function renderEnv(variables: Record<string, string> = {}, options: Parameters<typeof createFakeEnvKeySource>[1] = {}, enabled = false) {
  const env = createFakeEnvKeySource(variables, options);
  const storage = createMemoryEnvChoiceStorage(enabled ? { enabled: true, names: {} } : null);
  const choices = new EnvKeyChoices({ storage, channel: null });
  let keys!: ProviderKeySource;
  const onKeySaved = vi.fn();
  function Wired(): React.JSX.Element {
    const prompt = usePasswordPrompt();
    const vault = useMemo(() => new KeyVault({ storage: createMemoryVaultStorage(), requestPassword: prompt.requestPassword, kdfIterations: 1000, channel: null }), [prompt.requestPassword]);
    keys = useMemo(() => new ProviderKeySource({ vault, choices, env }), [vault]);
    return <KeySettingsSection vault={vault} prompt={prompt} env={{ keys, choices }} onKeySaved={onKeySaved} />;
  }
  const view = render(<Wired />);
  await keys.detectEnvSupport();
  await waitFor(() => expect(keys.envOffered()).toBe(options.offered ?? true));
  return { ...view, env, choices, storage, onKeySaved, user: userEvent.setup(), getKeys: () => keys };
}

describe('keys ui environment keys', () => {
  it('R14 the switch is shown when the host offers the environment and hidden when it does not', async () => {
    await renderEnv();
    await waitFor(() => expect(switchRow()).not.toBeNull());
    cleanup();
    await renderEnv({}, { offered: false });
    expect(switchRow()).toBeNull();
  });

  it('R13 one switch for all providers, off by default, at the top beside the title', async () => {
    await renderEnv();
    await waitFor(() => expect(switchRow()).not.toBeNull());
    expect((switchRow() as HTMLInputElement).checked).toBe(false);
    expect(screen.getAllByRole('switch')).toHaveLength(1);
    expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy();
  });

  it('R13 pressing the switch takes effect at once: rows ask for names, with the example text, and it is remembered', async () => {
    const { user, choices, storage } = await renderEnv();
    await waitFor(() => expect(switchRow()).not.toBeNull());
    await user.click(switchRow()!);
    expect(choices.enabled()).toBe(true);
    expect(storage.saved?.enabled).toBe(true);
    await user.click(row('Gemini').getByRole('button', { name: 'Add name' }));
    const field = row('Gemini').getByLabelText('Gemini environment variable name') as HTMLInputElement;
    expect(field.placeholder).toBe('GEMINI_API_KEY');
    await user.click(row('Gemini').getByRole('button', { name: 'Cancel' }));
    await user.click(row('OpenAI').getByRole('button', { name: 'Add name' }));
    expect((row('OpenAI').getByLabelText('OpenAI environment variable name') as HTMLInputElement).placeholder).toBe('OPENAI_API_KEY');
  });

  it('R1 (generate R43) the OpenRouter row suggests OR_API_KEY and reads that variable', async () => {
    const { user, choices } = await renderEnv({ OR_API_KEY: 'or-abc' });
    await waitFor(() => expect(switchRow()).not.toBeNull());
    await user.click(switchRow()!);
    await user.click(row('OpenRouter').getByRole('button', { name: 'Add name' }));
    const field = row('OpenRouter').getByLabelText('OpenRouter environment variable name') as HTMLInputElement;
    expect(field.placeholder).toBe('OR_API_KEY');
    await user.type(field, 'OR_API_KEY');
    await user.click(row('OpenRouter').getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(choices.nameOf('openrouter')).toBe('OR_API_KEY'));
  });

  it('R15 no rule on names: any typed name enables Save and no format message shows; only an empty field disables it', async () => {
    const { user } = await renderEnv({}, {}, true);
    await user.click(row('Gemini').getByRole('button', { name: 'Add name' }));
    const save = row('Gemini').getByRole('button', { name: 'Save' }) as HTMLButtonElement;
    expect(save.disabled).toBe(true);
    await user.type(row('Gemini').getByLabelText('Gemini environment variable name'), 'PATH');
    expect(save.disabled).toBe(false);
    expect(row('Gemini').queryByText(/ending in KEY/)).toBeNull();
  });

  it('R16 Save with a variable that is set saves the name, shows Found, and runs the key check once', async () => {
    const { user, choices, onKeySaved } = await renderEnv({ GEMINI_API_KEY: 'abc' }, {}, true);
    await user.click(row('Gemini').getByRole('button', { name: 'Add name' }));
    await user.type(row('Gemini').getByLabelText('Gemini environment variable name'), 'GEMINI_API_KEY');
    await user.click(row('Gemini').getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(choices.nameOf('gemini')).toBe('GEMINI_API_KEY'));
    expect(row('Gemini').getByText('Environment: GEMINI_API_KEY')).toBeTruthy();
    await waitFor(() => expect(row('Gemini').getByText('Found')).toBeTruthy());
    expect(onKeySaved).toHaveBeenCalledTimes(1);
    expect(onKeySaved).toHaveBeenCalledWith('gemini');
  });

  it('R16 Save with a variable that is not set keeps the field open with the message and saves nothing', async () => {
    const { user, choices, onKeySaved } = await renderEnv({}, {}, true);
    await user.click(row('OpenAI').getByRole('button', { name: 'Add name' }));
    await user.type(row('OpenAI').getByLabelText('OpenAI environment variable name'), 'OPEN_AI_KEY');
    await user.click(row('OpenAI').getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getAllByText('"OPEN_AI_KEY" is not set.').length).toBeGreaterThan(0));
    expect(choices.nameOf('openai')).toBeUndefined();
    expect(onKeySaved).not.toHaveBeenCalled();
    expect(row('OpenAI').getByLabelText('OpenAI environment variable name')).toBeTruthy();
  });

  it('R16 the desktop host adds the restart sentence', async () => {
    const { user } = await renderEnv({}, { needsRestart: true }, true);
    await user.click(row('Gemini').getByRole('button', { name: 'Add name' }));
    await user.type(row('Gemini').getByLabelText('Gemini environment variable name'), 'GEMINI_API_KEY');
    await user.click(row('Gemini').getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.getAllByText('"GEMINI_API_KEY" is not set. If you just set it, restart the app.').length).toBeGreaterThan(0));
  });

  it('R20 a saved name shows Found or Not found from one read when the section opens, and the value is never shown', async () => {
    const env = { OPEN_AI_KEY: 'SECRET-VALUE-9876' };
    const { choices } = await renderEnv(env, {}, true);
    choices.setName('gemini', 'GEMINI_API_KEY');
    choices.setName('openai', 'OPEN_AI_KEY');
    await waitFor(() => expect(row('OpenAI').getByText('Found')).toBeTruthy());
    expect(row('Gemini').getByText('Not found')).toBeTruthy();
    expect(document.body.textContent).not.toContain('SECRET-VALUE');
    expect(Array.from(document.querySelectorAll('input')).map((input) => input.value).join('')).not.toContain('SECRET-VALUE');
  });

  it('R19 Remove forgets a name only; Replace changes it', async () => {
    const { user, choices } = await renderEnv({ A_KEY: 'value-a', B_KEY: 'value-b' }, {}, true);
    choices.setName('gemini', 'A_KEY');
    await user.click(await row('Gemini').findByRole('button', { name: 'Replace' }));
    const field = row('Gemini').getByLabelText('Gemini environment variable name');
    await user.clear(field);
    await user.type(field, 'B_KEY');
    await user.click(row('Gemini').getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(choices.nameOf('gemini')).toBe('B_KEY'));
    await user.click(row('Gemini').getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(choices.nameOf('gemini')).toBeUndefined());
    expect(choices.enabled()).toBe(true);
  });

  it('R18 with the switch on the rows show no Encrypted status', async () => {
    await renderEnv({}, {}, true);
    expect(screen.queryByText(/Encrypted/)).toBeNull();
  });

  it('R24 saved on but not offered: the switch stays (on) so it can be turned off, a plain message shows, and no row offers a name', async () => {
    const { user, choices } = await renderEnv({}, { offered: false }, true);
    expect((switchRow() as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText('Environment keys are not available here.')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add name' })).toBeNull();
    await user.click(switchRow()!);
    expect(choices.enabled()).toBe(false);
    expect(screen.queryByText('Environment keys are not available here.')).toBeNull();
    expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy();
  });
});
