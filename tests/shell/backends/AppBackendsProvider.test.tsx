// @vitest-environment jsdom
import { act, cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { AppBackends, ResolvedBackends } from '../../../src/shell/backends/appBackends';
import { AppBackendsProvider, useAppBackends } from '../../../src/shell/backends/AppBackendsProvider';
import { KeyVault } from '../../../src/keys/KeyVault';
import { createMemoryVaultStorage } from '../../keys/memoryVaultStorage';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const PASSWORD = 'a long enough password';
const GEMINI = 'AIzaSyGEMINI-0123456789-abcdWXYZ';

function makeBackends(storage = createMemoryVaultStorage()): AppBackends & { storage: typeof storage } {
  return { createImageGenerator: vi.fn(), createPromptEnhancer: vi.fn(), vaultStorage: storage, kdfIterations: 1000, storage };
}

async function seedVaultWithGeminiKey(storage: ReturnType<typeof createMemoryVaultStorage>): Promise<void> {
  const vault = new KeyVault({ storage, requestPassword: async () => ({ password: PASSWORD, confirm: PASSWORD }), kdfIterations: 1000, channel: null });
  await vault.refresh();
  expect((await vault.setKey('gemini', GEMINI)).ok).toBe(true);
}

function renderProbe(backends: AppBackends) {
  const seen: ResolvedBackends[] = [];
  function Probe(): null {
    seen.push(useAppBackends());
    return null;
  }
  const view = render(
    <AppBackendsProvider backends={backends}>
      <Probe />
    </AppBackendsProvider>,
  );
  const rerender = (): void => view.rerender(
    <AppBackendsProvider backends={backends}>
      <Probe />
    </AppBackendsProvider>,
  );
  return { seen, rerender };
}

describe('AppBackendsProvider', () => {
  it('R21 the injected generator factories and a key vault reach the children', () => {
    const backends = makeBackends();
    const { seen } = renderProbe(backends);
    const value = seen[seen.length - 1];
    expect(value?.createImageGenerator).toBe(backends.createImageGenerator);
    expect(value?.createPromptEnhancer).toBe(backends.createPromptEnhancer);
    expect(value?.keys).toBeInstanceOf(KeyVault);
  });

  it('settings R4 settings R6 the injected model discovery reaches the children, the real one is the default, and the password prompt is exposed', () => {
    const discoverModels = vi.fn();
    const injected = renderProbe({ ...makeBackends(), discoverModels });
    expect(injected.seen[injected.seen.length - 1]?.discoverModels).toBe(discoverModels);
    const defaulted = renderProbe(makeBackends());
    const value = defaulted.seen[defaulted.seen.length - 1];
    expect(typeof value?.discoverModels).toBe('function');
    expect(typeof value?.passwordPrompt.answer).toBe('function');
    expect(typeof value?.passwordPrompt.refuseRequests).toBe('function');
  });

  it('R21 useAppBackends without a provider throws', () => {
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
    function Probe(): null {
      useAppBackends();
      return null;
    }
    expect(() => render(<Probe />)).toThrow(/AppBackendsProvider/);
  });

  it('R21 the vault is built once, however often the app re-renders', () => {
    const { seen, rerender } = renderProbe(makeBackends());
    rerender();
    rerender();
    expect(new Set(seen.map((value) => value.keys)).size).toBe(1);
  });

  it('R20 the vault is read once at startup, so the key flags are known while it is locked', async () => {
    const storage = createMemoryVaultStorage();
    await seedVaultWithGeminiKey(storage);
    const load = vi.spyOn(storage, 'load');
    const { seen, rerender } = renderProbe(makeBackends(storage));
    rerender();
    const keys = seen[0]?.keys as KeyVault;
    await waitFor(() => expect(keys.hasKey('gemini')).toBe(true));
    expect(keys.status()).toBe('locked');
    expect(keys.hasKey('openai')).toBe(false);
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('R20 keysLoaded is false until the first read of the stored vault ends, then true', async () => {
    const { seen } = renderProbe(makeBackends());
    expect(seen[0]?.keysLoaded).toBe(false);
    await waitFor(() => expect(seen[seen.length - 1]?.keysLoaded).toBe(true));
  });

  it('R21 an unlock request is answered by the dialog the provider mounts', async () => {
    const storage = createMemoryVaultStorage();
    await seedVaultWithGeminiKey(storage);
    const { seen } = renderProbe(makeBackends(storage));
    const keys = seen[0]?.keys as KeyVault;
    await waitFor(() => expect(keys.status()).toBe('locked'));
    let unlocking: Promise<unknown> = Promise.resolve();
    act(() => {
      unlocking = keys.ensureUnlocked();
    });
    const user = userEvent.setup();
    await user.type(await screen.findByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await act(async () => {
      await unlocking;
    });
    expect(keys.status()).toBe('unlocked');
    expect(keys.getKey('gemini')).toBe(GEMINI);
  });

  it('R21 cancelling the dialog leaves the vault locked', async () => {
    const storage = createMemoryVaultStorage();
    await seedVaultWithGeminiKey(storage);
    const { seen } = renderProbe(makeBackends(storage));
    const keys = seen[0]?.keys as KeyVault;
    await waitFor(() => expect(keys.status()).toBe('locked'));
    let unlocking: Promise<{ ok: boolean }> = Promise.resolve({ ok: true });
    act(() => {
      unlocking = keys.ensureUnlocked();
    });
    await userEvent.setup().click(await screen.findByRole('button', { name: 'Cancel' }));
    await act(async () => {
      expect((await unlocking).ok).toBe(false);
    });
    expect(keys.status()).toBe('locked');
  });
});
