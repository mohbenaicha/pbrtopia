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

  it('settings R20 the page has one description sentence about encryption and at-rest protection, and nothing else repeats it', async () => {
    show();
    await waitFor(() => expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy());
    expect(document.querySelector('.settings-page__description')?.textContent).toBe(
      'Keys are encrypted with your password and stay in this browser; this protects them at rest only, not against XSS or a malicious extension.',
    );
    expect(screen.getAllByText(/at rest only/i)).toHaveLength(1);
    expect(screen.getAllByText(/stay in this browser/i)).toHaveLength(1);
  });

  it('api-keys R22 the description gains the environment sentence only when the host offers environment keys', async () => {
    const offered = { ...backends(), envKeySource: { available: async () => true, read: async () => ({ ok: false as const, reason: 'not-set' as const }), needsRestart: false } };
    render(
      <AppBackendsProvider backends={offered}>
        <ApiKeysSection rejectedKeys={{}} onKeySaved={vi.fn()} />
      </AppBackendsProvider>,
    );
    await waitFor(() => expect(document.querySelector('.settings-page__description')?.textContent).toContain('Or read them from environment variables each time they are used; the app does not store them there, and any program on this computer can read them.'));
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
