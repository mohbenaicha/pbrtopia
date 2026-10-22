// @vitest-environment jsdom
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createMemoryVaultStorage } from '../memoryVaultStorage';
import { GEMINI, OPENAI, PASSWORD, renderKeys } from './keysHarness';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const row = (name: 'Gemini' | 'OpenAI') => within(screen.getByRole('group', { name }));
const inputValues = (): string => Array.from(document.querySelectorAll('input')).map((input) => input.value).join('|');
type User = ReturnType<typeof renderKeys>['user'];

async function addKey(user: User, name: 'Gemini' | 'OpenAI', key: string): Promise<void> {
  await user.click(row(name).getByRole('button', { name: /^(Add key|Replace)$/ }));
  await user.type(row(name).getByLabelText(`${name} key`), key);
  await user.click(row(name).getByRole('button', { name: 'Save' }));
}

async function createVaultWithGemini(user: User): Promise<void> {
  await addKey(user, 'Gemini', GEMINI);
  await user.type(screen.getByLabelText('Password'), PASSWORD);
  await user.type(screen.getByLabelText('Confirm password'), PASSWORD);
  await user.click(screen.getByRole('button', { name: 'Create' }));
  await waitFor(() => expect(row('Gemini').getByText('Encrypted, unlocked')).toBeTruthy());
}

describe('KeySettingsSection', () => {
  it('R1 there is a row for Gemini and one for OpenAI, each offering Add key when nothing is stored', () => {
    renderKeys();
    for (const name of ['Gemini', 'OpenAI'] as const) {
      expect(row(name).getByRole('button', { name: 'Add key' })).toBeTruthy();
      expect(row(name).queryByRole('button', { name: 'Replace' })).toBeNull();
      expect(row(name).queryByRole('button', { name: 'Remove' })).toBeNull();
    }
    expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
  });

  it('settings R3 onKeySaved reports the provider once after a key is saved, also for the same text again, and not after a key that is too short', async () => {
    const onKeySaved = vi.fn();
    const { user } = renderKeys({ onKeySaved });
    await addKey(user, 'Gemini', 'short');
    await waitFor(() => expect(row('Gemini').getByRole('alert')).toBeTruthy());
    expect(onKeySaved).not.toHaveBeenCalled();
    await user.clear(row('Gemini').getByLabelText('Gemini key'));
    await user.type(row('Gemini').getByLabelText('Gemini key'), GEMINI);
    await user.click(row('Gemini').getByRole('button', { name: 'Save' }));
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(onKeySaved).toHaveBeenCalledTimes(1));
    expect(onKeySaved).toHaveBeenLastCalledWith('gemini');
    await addKey(user, 'Gemini', GEMINI);
    await waitFor(() => expect(onKeySaved).toHaveBeenCalledTimes(2));
  });

  it('R9 the section says keys stay in this browser, and that this protects keys at rest only', () => {
    renderKeys();
    expect(screen.getByText('Keys are encrypted with your password and stay in this browser.')).toBeTruthy();
    const warning = screen.getByText(/at rest only/i).textContent ?? '';
    expect(warning).toMatch(/XSS/);
    expect(warning).toMatch(/malicious extension/);
    expect(warning).toMatch(/garbage collection/);
  });

  it('R1 the key field is a password field, so a pasted key is not shown', async () => {
    const { user } = renderKeys();
    await user.click(row('Gemini').getByRole('button', { name: 'Add key' }));
    expect((row('Gemini').getByLabelText('Gemini key') as HTMLInputElement).type).toBe('password');
  });

  it('R3 the first key asks for a new password with its confirmation, then the row shows the dots, the hint and the unlocked status', async () => {
    const { user, storage } = renderKeys();
    await createVaultWithGemini(user);
    expect(row('Gemini').getByText('••••WXYZ')).toBeTruthy();
    expect(row('Gemini').getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(row('Gemini').getByRole('button', { name: 'Remove' })).toBeTruthy();
    expect(row('OpenAI').getByRole('button', { name: 'Add key' })).toBeTruthy();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(storage.peek()?.keys.gemini?.hint).toBe('WXYZ');
    expect(document.body.textContent).not.toContain(GEMINI);
    expect(inputValues()).not.toContain(GEMINI); // and the key is not left in a field either
  });

  it('R3 a new password under 8 characters, or a confirmation that differs, is refused in the dialog and nothing is saved', async () => {
    const { user, storage } = renderKeys();
    await addKey(user, 'Gemini', GEMINI);
    await user.type(screen.getByLabelText('Password'), 'short');
    await user.type(screen.getByLabelText('Confirm password'), 'short');
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert').textContent).toBe('The password must be at least 8 characters.');
    await user.clear(screen.getByLabelText('Password'));
    await user.clear(screen.getByLabelText('Confirm password'));
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.type(screen.getByLabelText('Confirm password'), `${PASSWORD}!`);
    await user.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert').textContent).toBe('The two passwords are not the same.');
    expect(screen.getByRole('dialog')).toBeTruthy();
    expect(storage.peek()).toBeNull();
  });

  it('R3 cancelling the new-password dialog saves nothing and the row says so', async () => {
    const { user, storage } = renderKeys();
    await addKey(user, 'Gemini', GEMINI);
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(row('Gemini').getByText('No password was entered.')).toBeTruthy());
    expect(storage.peek()).toBeNull();
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(row('Gemini').queryByLabelText('Gemini key')).toBeNull(); // the key field closed, so no key stays on the page
    expect(inputValues()).not.toContain(GEMINI);
  });

  it('viewport-layout R22 focus moves into the key field when it opens and back to the row button when it closes', async () => {
    const { user } = renderKeys();
    await user.click(row('Gemini').getByRole('button', { name: 'Add key' }));
    expect(document.activeElement).toBe(row('Gemini').getByLabelText('Gemini key'));
    await user.click(row('Gemini').getByRole('button', { name: 'Cancel' }));
    expect(document.activeElement).toBe(row('Gemini').getByRole('button', { name: 'Add key' }));
  });

  it('R7 a key that is too short is refused under the field, the field stays open, and Cancel closes it without a change', async () => {
    const { user, storage } = renderKeys();
    await addKey(user, 'Gemini', 'short');
    await waitFor(() => expect(row('Gemini').getByText(/not valid/)).toBeTruthy());
    expect(row('Gemini').getByLabelText('Gemini key')).toBeTruthy();
    await user.click(row('Gemini').getByRole('button', { name: 'Cancel' }));
    expect(row('Gemini').queryByLabelText('Gemini key')).toBeNull();
    expect(storage.peek()).toBeNull();
  });

  it('R12 the Lock button shows only while unlocked; locking keeps the dots and hint and says Encrypted, locked', async () => {
    const { user } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    expect(row('Gemini').getByText('Encrypted, locked')).toBeTruthy();
    expect(row('Gemini').getByText('••••WXYZ')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Lock' })).toBeNull();
  });

  it('R7 replacing a key in an unlocked vault asks for no password and updates the hint', async () => {
    const { user } = renderKeys();
    await createVaultWithGemini(user);
    await addKey(user, 'Gemini', 'AIzaSy-replacement-key-0000-ZZZZ');
    await waitFor(() => expect(row('Gemini').getByText('••••ZZZZ')).toBeTruthy());
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R3 adding a key to a locked vault asks to unlock, and the keys already stored stay', async () => {
    const { user, getVault } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await addKey(user, 'OpenAI', OPENAI);
    expect(screen.getByRole('dialog', { name: 'Enter your password' })).toBeTruthy();
    await user.type(screen.getByLabelText('Password'), PASSWORD);
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(row('OpenAI').getByText('••••QRST')).toBeTruthy());
    expect(getVault().getKey('gemini')).toBe(GEMINI);
  });

  it('R5 a wrong password is reported on the row, nothing changes and the vault stays locked', async () => {
    const { user, getVault, storage } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    const before = storage.peek();
    await addKey(user, 'OpenAI', OPENAI);
    await user.type(screen.getByLabelText('Password'), 'not the password');
    await user.click(screen.getByRole('button', { name: 'Unlock' }));
    await waitFor(() => expect(row('OpenAI').getByText('That password is not right.')).toBeTruthy());
    expect(storage.peek()).toEqual(before);
    expect(getVault().status()).toBe('locked');
  });

  it('R7 Remove deletes that provider\'s key only', async () => {
    const { user } = renderKeys();
    await createVaultWithGemini(user);
    await addKey(user, 'OpenAI', OPENAI);
    await waitFor(() => expect(row('OpenAI').getByText('••••QRST')).toBeTruthy());
    await user.click(row('Gemini').getByRole('button', { name: 'Remove' }));
    await waitFor(() => expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy());
    expect(row('OpenAI').getByText('••••QRST')).toBeTruthy();
  });

  it('R6 Forgot password asks for a confirmation; Cancel goes back to the password dialog and nothing is deleted', async () => {
    const { user, storage } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await addKey(user, 'OpenAI', OPENAI);
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    expect(screen.getByRole('dialog', { name: 'Forget your password?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.getByRole('dialog', { name: 'Enter your password' })).toBeTruthy();
    expect(storage.peek()).not.toBeNull();
  });

  it('R6 confirming Forgot password deletes every saved key and leaves rows ready for new ones', async () => {
    const { user, storage, getVault } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await addKey(user, 'OpenAI', OPENAI);
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(storage.peek()).toBeNull());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(getVault().status()).toBe('none');
    expect(row('Gemini').getByRole('button', { name: 'Add key' })).toBeTruthy();
    expect(row('OpenAI').getByRole('button', { name: 'Add key' })).toBeTruthy();
  });

  it('R6 Forgot password still deletes the keys when another change is queued behind the open password question', async () => {
    const { user, storage, getVault } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    await addKey(user, 'OpenAI', OPENAI); // waits for the password
    // Another caller (the Generate flow, say) changes the vault while the question is open: it is queued behind it.
    let queued!: Promise<{ ok: boolean }>;
    act(() => {
      queued = getVault().setKey('gemini', 'AIzaSy-replacement-key-0000-ZZZZ');
    });
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(storage.peek()).toBeNull());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(getVault().status()).toBe('none');
    expect((await queued).ok).toBe(false);
  });

  it('R6 a stored vault that cannot be read is reported with Reset saved keys, which asks first, wipes it and allows a new key', async () => {
    const storage = createMemoryVaultStorage();
    const load = vi.spyOn(storage, 'load').mockRejectedValue(new Error('The key vault could not be read.'));
    const clear = vi.spyOn(storage, 'clear');
    const { user } = renderKeys({ storage });
    await waitFor(() => expect(screen.getByText(/could not be read or saved/)).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    expect(screen.getByRole('dialog', { name: 'Reset saved keys?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(clear).not.toHaveBeenCalled();
    load.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/could not be read or saved/)).toBeNull();
    expect(screen.queryByRole('button', { name: 'Reset saved keys' })).toBeNull();
    await createVaultWithGemini(user);
  });

  it('R6 a failed delete shows its message in the Reset dialog and the vault stays as it was, so the reset can be tried again', async () => {
    const storage = createMemoryVaultStorage();
    vi.spyOn(storage, 'load').mockRejectedValue(new Error('x'));
    const clear = vi.spyOn(storage, 'clear').mockRejectedValueOnce(new Error('The key vault could not be deleted.'));
    const { user, getVault } = renderKeys({ storage });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset saved keys' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(within(screen.getByRole('dialog', { name: 'Reset saved keys?' })).getByText('The key vault could not be deleted.')).toBeTruthy());
    expect(getVault().loadProblem()).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(clear).toHaveBeenCalledTimes(2);
    expect(getVault().loadProblem()).toBeNull();
  });

  it('R6 a delete that fails while the vault becomes readable again still shows its message', async () => {
    const storage = createMemoryVaultStorage();
    const load = vi.spyOn(storage, 'load').mockRejectedValue(new Error('x'));
    let fail!: () => void;
    vi.spyOn(storage, 'clear').mockImplementationOnce(() => new Promise<void>((_resolve, reject) => (fail = () => reject(new Error('The key vault could not be deleted.')))));
    const { user, getVault } = renderKeys({ storage });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset saved keys' })).toBeTruthy());
    await user.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    load.mockRestore(); // the storage recovers while the delete is still running
    await act(async () => {
      await getVault().refresh();
    });
    expect(getVault().loadProblem()).toBeNull();
    await act(async () => fail());
    await waitFor(() => expect(screen.getByText('The key vault could not be deleted.')).toBeTruthy());
  });

  it('R6 Reset cancels a password question that is still open, so the keys that question was about are not saved and then deleted', async () => {
    const { user, storage, getVault } = renderKeys();
    await createVaultWithGemini(user);
    await user.click(screen.getByRole('button', { name: 'Lock' }));
    let queued!: Promise<{ ok: boolean }>;
    act(() => {
      queued = getVault().setKey('openai', OPENAI); // asks for the password
    });
    await waitFor(() => expect(screen.getByLabelText('Password')).toBeTruthy());
    // Another tab damages the vault: the next read fails, and Reset appears under the open password question.
    vi.spyOn(storage, 'load').mockRejectedValue(new Error('x'));
    await act(async () => {
      await getVault().refresh();
    });
    // The password dialog sits over the Reset dialog, so the clicks are sent to the buttons directly.
    act(() => screen.getByRole('button', { name: 'Reset saved keys', hidden: true }).click());
    act(() => screen.getByRole('button', { name: 'Delete saved keys', hidden: true }).click());
    await waitFor(() => expect(storage.peek()).toBeNull());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect((await queued).ok).toBe(false);
    expect(getVault().status()).toBe('none');
  });

  it('R6 the failure message of an earlier Save goes away when Reset recovers the vault', async () => {
    const storage = createMemoryVaultStorage();
    const load = vi.spyOn(storage, 'load').mockRejectedValue(new Error('x'));
    const { user } = renderKeys({ storage });
    await waitFor(() => expect(screen.getByRole('button', { name: 'Reset saved keys' })).toBeTruthy());
    await addKey(user, 'Gemini', GEMINI);
    await waitFor(() => expect(row('Gemini').getByText(/could not be read or saved/)).toBeTruthy());
    load.mockRestore();
    await user.click(screen.getByRole('button', { name: 'Reset saved keys' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.queryByText(/could not be read or saved/)).toBeNull();
  });

  it('R6 there is no Reset saved keys button while the vault reads fine', () => {
    renderKeys();
    expect(screen.queryByRole('button', { name: 'Reset saved keys' })).toBeNull();
  });

  it('R11 a key the provider rejected is flagged on its row with the message given, and the key stays', async () => {
    const { user } = renderKeys({ rejectedKeys: { gemini: 'Google did not accept this key.' } });
    await createVaultWithGemini(user);
    expect(row('Gemini').getByText('Google did not accept this key.')).toBeTruthy();
    expect(row('Gemini').getByText('••••WXYZ')).toBeTruthy();
    expect(row('OpenAI').queryByText('Google did not accept this key.')).toBeNull();
  });

  it('R12 the rows follow changes made outside the section, such as the vault being locked by code', async () => {
    const { user, getVault } = renderKeys();
    await createVaultWithGemini(user);
    act(() => getVault().lock());
    expect(row('Gemini').getByText('Encrypted, locked')).toBeTruthy();
  });

  it('R3 a vault stored by an earlier session is shown as locked with its hints when the section opens', async () => {
    const first = renderKeys();
    await createVaultWithGemini(first.user);
    const { storage } = first;
    first.unmount();
    renderKeys({ storage });
    await waitFor(() => expect(row('Gemini').getByText('Encrypted, locked')).toBeTruthy());
    expect(row('Gemini').getByText('••••WXYZ')).toBeTruthy();
  });
});
