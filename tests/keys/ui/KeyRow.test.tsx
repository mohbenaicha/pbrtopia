// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { KEY_OK, keyFailure, type KeyResult } from '../../../src/keys/keyError';
import type { KeyVault } from '../../../src/keys/KeyVault';
import { KeyRow } from '../../../src/keys/ui/KeyRow';

afterEach(cleanup);

interface VaultState {
  stored?: boolean;
  status?: 'none' | 'locked' | 'unlocked';
  setKey?: () => Promise<KeyResult<void>>;
  removeKey?: () => Promise<KeyResult<void>>;
}

function setup(state: VaultState = {}, props: Partial<React.ComponentProps<typeof KeyRow>> = {}) {
  const vault = {
    hasKey: () => state.stored ?? false,
    hint: () => 'WXYZ',
    status: () => state.status ?? 'none',
    setKey: vi.fn(state.setKey ?? (async () => KEY_OK)),
    removeKey: vi.fn(state.removeKey ?? (async () => KEY_OK)),
  };
  const onMessage = vi.fn();
  const onKeySaved = vi.fn();
  const view = render(<KeyRow provider="gemini" label="Gemini" vault={vault as unknown as KeyVault} message={undefined} rejected={undefined} onMessage={onMessage} onKeySaved={onKeySaved} {...props} />);
  return { vault, onMessage, onKeySaved, user: userEvent.setup(), ...view };
}

const group = (): HTMLElement => screen.getByRole('group', { name: 'Gemini' });

describe('KeyRow', () => {
  it('R1 a provider with no key says Not set and offers Add key only', () => {
    setup();
    expect(group().textContent).toContain('Not set');
    expect(screen.getByRole('button', { name: 'Add key' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(group().textContent).not.toContain('Encrypted');
  });

  it('R1 a stored key shows dots with its hint and the vault status, and offers Replace and Remove', () => {
    setup({ stored: true, status: 'locked' });
    expect(group().textContent).toContain('••••WXYZ');
    expect(group().textContent).toContain('Encrypted, locked');
    expect(screen.getByRole('button', { name: 'Replace' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Remove' })).toBeTruthy();
  });

  it('R1 an unlocked vault says so', () => {
    setup({ stored: true, status: 'unlocked' });
    expect(group().textContent).toContain('Encrypted, unlocked');
  });

  it('R7 Save is disabled until something is typed; saving sends that text, closes the field and reports the save', async () => {
    const { user, vault, onKeySaved } = setup();
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    const field = screen.getByLabelText('Gemini key') as HTMLInputElement;
    expect(field.type).toBe('password');
    expect((screen.getByRole('button', { name: 'Save' }) as HTMLButtonElement).disabled).toBe(true);
    await user.type(field, 'AIza-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(vault.setKey).toHaveBeenCalledWith('gemini', 'AIza-secret');
    expect(onKeySaved).toHaveBeenCalledTimes(1);
    expect(screen.queryByLabelText('Gemini key')).toBeNull();
  });

  it('R7 a key that is too short stays in the field and its message goes to onMessage', async () => {
    const { user, onMessage, onKeySaved } = setup({ setKey: async () => keyFailure('invalid-key') });
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('Gemini key'), 'abc');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((screen.getByLabelText('Gemini key') as HTMLInputElement).value).toBe('abc');
    expect(onMessage).toHaveBeenLastCalledWith(keyFailure('invalid-key').error.message);
    expect(onKeySaved).not.toHaveBeenCalled();
  });

  it('R7 any other failure closes the field and clears the draft, so no key is left on the page', async () => {
    const { user, onMessage, onKeySaved } = setup({ setKey: async () => keyFailure('storage-failed') });
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('Gemini key'), 'AIza-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect(screen.queryByLabelText('Gemini key')).toBeNull();
    expect(onMessage).toHaveBeenLastCalledWith(keyFailure('storage-failed').error.message);
    expect(onKeySaved).not.toHaveBeenCalled();
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect((screen.getByLabelText('Gemini key') as HTMLInputElement).value).toBe('');
  });

  it('R7 Cancel closes the field without saving, drops the draft and clears the message', async () => {
    const { user, vault, onMessage } = setup();
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('Gemini key'), 'AIza-secret');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(vault.setKey).not.toHaveBeenCalled();
    expect(onMessage).toHaveBeenLastCalledWith(null);
    expect(screen.queryByLabelText('Gemini key')).toBeNull();
  });

  it('R7 while a save is running, the field and Cancel are not available', async () => {
    let finish!: (result: KeyResult<void>) => void;
    const { user } = setup({ setKey: () => new Promise((resolve) => { finish = resolve; }) });
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    await user.type(screen.getByLabelText('Gemini key'), 'AIza-secret');
    await user.click(screen.getByRole('button', { name: 'Save' }));
    expect((screen.getByLabelText('Gemini key') as HTMLInputElement).disabled).toBe(true);
    expect(screen.queryByRole('button', { name: 'Cancel' })).toBeNull();
    await vi.waitFor(() => expect(finish).toBeTypeOf('function'));
    finish(KEY_OK);
    await vi.waitFor(() => expect(screen.queryByLabelText('Gemini key')).toBeNull());
  });

  it('R7 Remove asks the vault to remove that provider and reports a failure, and says nothing on success', async () => {
    const failing = setup({ stored: true, removeKey: async () => keyFailure('storage-failed') });
    await failing.user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(failing.vault.removeKey).toHaveBeenCalledWith('gemini');
    expect(failing.onMessage).toHaveBeenLastCalledWith(keyFailure('storage-failed').error.message);
    cleanup();
    const working = setup({ stored: true });
    await working.user.click(screen.getByRole('button', { name: 'Remove' }));
    expect(working.vault.removeKey).toHaveBeenCalledWith('gemini');
    expect(working.onMessage).toHaveBeenCalledTimes(1);
    expect(working.onMessage).toHaveBeenCalledWith(null);
  });

  it('R7 the last failure of an action is an alert on the row while no field is open, and an error on the field while it is', async () => {
    const { user, rerender, vault, onMessage } = setup({}, { message: 'Could not save.' });
    expect(screen.getByRole('alert').textContent).toBe('Could not save.');
    await user.click(screen.getByRole('button', { name: 'Add key' }));
    expect(screen.getByLabelText('Gemini key').getAttribute('aria-invalid')).toBe('true');
    expect(screen.getByRole('alert').textContent).toBe('Could not save.');
    rerender(<KeyRow provider="gemini" label="Gemini" vault={vault as unknown as KeyVault} message={undefined} rejected={undefined} onMessage={onMessage} />);
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R11 a key the provider rejected is flagged only while a key is stored', () => {
    const stored = setup({ stored: true }, { rejected: 'Gemini refused this key.' });
    expect(group().textContent).toContain('Gemini refused this key.');
    stored.unmount();
    setup({ stored: false }, { rejected: 'Gemini refused this key.' });
    expect(group().textContent).not.toContain('Gemini refused this key.');
  });
});
