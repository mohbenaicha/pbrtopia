// @vitest-environment jsdom
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBackends } from '../../../src/shell/backends/appBackends';
import { AppBackendsProvider } from '../../../src/shell/backends/AppBackendsProvider';
import { ApiKeysSection } from '../../../src/shell/settings/ApiKeysSection';
import { KeyVault } from '../../../src/keys/KeyVault';
import { createMemoryVaultStorage } from '../../keys/memoryVaultStorage';
import { GEMINI, PASSWORD } from '../../keys/ui/keysHarness';

afterEach(cleanup);

const backends = (): AppBackends => ({ createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: createMemoryVaultStorage(), kdfIterations: 1000 });
const row = (name: string) => within(screen.getByRole('group', { name }));

function show(props: Partial<Parameters<typeof ApiKeysSection>[0]> = {}) {
  const onKeySaved = vi.fn();
  render(
    <AppBackendsProvider backends={backends()}>
      <ApiKeysSection rejectedKeys={{}} onKeySaved={onKeySaved} {...props} />
    </AppBackendsProvider>,
  );
  return { onKeySaved, user: userEvent.setup() };
}

describe('ApiKeysSection', () => {
  it('settings R3 it shows the key row of each provider, without a key stored', async () => {
    show();
    await waitFor(() => expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy());
    expect(row('OpenAI').getByRole('button', { name: 'Add key' })).toBeTruthy();
  });

  it('settings R3 saving a key goes through the app\'s own password question and then reports the provider once', async () => {
    const { user, onKeySaved } = show();
    await user.click(await within(await screen.findByRole('group', { name: 'Gemini' })).findByRole('button', { name: 'Add key' }));
    await user.type(row('Gemini').getByLabelText('Gemini key'), GEMINI);
    await user.click(row('Gemini').getByRole('button', { name: 'Save' }));
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onKeySaved).toHaveBeenCalledWith('gemini'));
    expect(onKeySaved).toHaveBeenCalledTimes(1);
    expect(row('Gemini').getByText('Encrypted, unlocked')).toBeTruthy();
  });

  it('settings R4 a stored key a provider refused is flagged on its own row only', async () => {
    const vaultStorage = createMemoryVaultStorage();
    const seeding = new KeyVault({ storage: vaultStorage, requestPassword: async () => ({ password: PASSWORD, confirm: PASSWORD }), kdfIterations: 1000, channel: null });
    await seeding.refresh();
    expect((await seeding.setKey('gemini', GEMINI)).ok).toBe(true);
    render(
      <AppBackendsProvider backends={{ ...backends(), vaultStorage }}>
        <ApiKeysSection rejectedKeys={{ gemini: 'Gemini refused this key. Check it and replace it.' }} onKeySaved={vi.fn()} />
      </AppBackendsProvider>,
    );
    expect(await screen.findByText('Gemini refused this key. Check it and replace it.')).toBeTruthy();
    expect(row('Gemini').getByText('Gemini refused this key. Check it and replace it.')).toBeTruthy();
    expect(row('OpenAI').queryByText(/refused/)).toBeNull();
  });
});
