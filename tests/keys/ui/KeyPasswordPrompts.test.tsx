// @vitest-environment jsdom
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { KeyVault } from '../../../src/keys/KeyVault';
import { KeyPasswordPrompts } from '../../../src/keys/ui/KeyPasswordPrompts';
import type { PasswordPrompt, PasswordPurpose } from '../../../src/keys/ui/usePasswordPrompt';

afterEach(cleanup);

function setup(purpose: PasswordPurpose | null, wipe: () => Promise<void> = async () => undefined) {
  const vault = { wipe: vi.fn(wipe) } as unknown as KeyVault;
  const prompt: PasswordPrompt = { requestPassword: vi.fn(), purpose, answer: vi.fn(), refuseRequests: vi.fn() };
  render(<KeyPasswordPrompts vault={vault} prompt={prompt} />);
  return { vault, prompt, user: userEvent.setup() };
}

describe('KeyPasswordPrompts (R3, R6)', () => {
  it('R3 nothing is shown while no password is asked for', () => {
    setup(null);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R3 the password dialog is shown for the purpose being asked, and its answer goes to the prompt', async () => {
    const { prompt, user } = setup('unlock');
    expect(screen.getByRole('dialog', { name: 'Enter your password' })).toBeTruthy();
    await user.type(screen.getByLabelText('Password'), 'my password{Enter}');
    expect(prompt.answer).toHaveBeenCalledWith({ password: 'my password' });
  });

  it('R6 Forgot password swaps the password dialog for the confirmation, and Cancel brings the password dialog back', async () => {
    const { vault, user } = setup('unlock');
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    expect(screen.queryByRole('dialog', { name: 'Enter your password' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Forget your password?' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(screen.queryByRole('dialog', { name: 'Forget your password?' })).toBeNull();
    expect(screen.getByRole('dialog', { name: 'Enter your password' })).toBeTruthy();
    expect(vault.wipe).not.toHaveBeenCalled();
  });

  it('R6 confirming wipes the vault, cancels the open question and closes the confirmation', async () => {
    const { vault, prompt, user } = setup('unlock');
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    expect(vault.wipe).toHaveBeenCalledTimes(1);
    expect(prompt.answer).toHaveBeenCalledWith(null);
    await waitFor(() => expect(screen.queryByRole('dialog', { name: 'Forget your password?' })).toBeNull());
  });

  it('R6 a wipe that fails keeps the confirmation open and shows why', async () => {
    const { user } = setup('unlock', async () => { throw new Error('Disk is full.'); });
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    expect((await screen.findByRole('alert')).textContent).toBe('Disk is full.');
    expect(screen.getByRole('dialog', { name: 'Forget your password?' })).toBeTruthy();
  });

  it('R6 cancelling after a failure clears the failure for the next time', async () => {
    const { user } = setup('unlock', async () => { throw new Error('Disk is full.'); });
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    await user.click(screen.getByRole('button', { name: 'Delete saved keys' }));
    await screen.findByRole('alert');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    await user.click(screen.getByRole('button', { name: 'Forgot password' }));
    expect(screen.queryByRole('alert')).toBeNull();
  });
});
