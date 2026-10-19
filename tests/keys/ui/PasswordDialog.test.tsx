// @vitest-environment jsdom
import { act, cleanup, render, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PasswordDialog } from '../../../src/keys/ui/PasswordDialog';
import { usePasswordPrompt } from '../../../src/keys/ui/usePasswordPrompt';

afterEach(cleanup);

describe('PasswordDialog', () => {
  it('R3 nothing is shown when no password is being asked for', () => {
    render(<PasswordDialog purpose={null} onAnswer={vi.fn()} />);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('R3 unlocking asks for the password only, with Cancel, Unlock and a Forgot password link', async () => {
    const onAnswer = vi.fn();
    const onForgotPassword = vi.fn();
    render(<PasswordDialog purpose="unlock" onAnswer={onAnswer} onForgotPassword={onForgotPassword} />);
    expect(screen.getByRole('dialog', { name: 'Enter your password' })).toBeTruthy();
    expect(screen.queryByLabelText('Confirm password')).toBeNull();
    expect((screen.getByLabelText('Password') as HTMLInputElement).type).toBe('password');
    await userEvent.type(screen.getByLabelText('Password'), 'my password');
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(onAnswer).toHaveBeenCalledWith({ password: 'my password' });
    await userEvent.click(screen.getByRole('button', { name: 'Forgot password' }));
    expect(onForgotPassword).toHaveBeenCalledTimes(1);
  });

  it('R3 Enter in the field unlocks, Escape and Cancel answer null', async () => {
    const onAnswer = vi.fn();
    render(<PasswordDialog purpose="unlock" onAnswer={onAnswer} />);
    await userEvent.type(screen.getByLabelText('Password'), 'my password{Enter}');
    expect(onAnswer).toHaveBeenLastCalledWith({ password: 'my password' });
    await userEvent.keyboard('{Escape}');
    expect(onAnswer).toHaveBeenLastCalledWith(null);
    await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onAnswer).toHaveBeenLastCalledWith(null);
  });

  it('R3 an empty password is not sent', async () => {
    const onAnswer = vi.fn();
    render(<PasswordDialog purpose="unlock" onAnswer={onAnswer} />);
    await userEvent.click(screen.getByRole('button', { name: 'Unlock' }));
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('R3 creating asks for the password and its confirmation, and sends both once they agree', async () => {
    const onAnswer = vi.fn();
    render(<PasswordDialog purpose="create" onAnswer={onAnswer} />);
    expect(screen.getByRole('dialog', { name: 'Choose a password' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Forgot password' })).toBeNull();
    await userEvent.type(screen.getByLabelText('Password'), 'long enough one');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'long enough one{Enter}');
    expect(onAnswer).toHaveBeenCalledWith({ password: 'long enough one', confirm: 'long enough one' });
  });

  it('R3 creating with fewer than 8 characters or a different confirmation shows why and sends nothing', async () => {
    const onAnswer = vi.fn();
    render(<PasswordDialog purpose="create" onAnswer={onAnswer} />);
    await userEvent.type(screen.getByLabelText('Password'), 'short');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert').textContent).toBe('The password must be at least 8 characters.');
    await userEvent.clear(screen.getByLabelText('Password'));
    await userEvent.type(screen.getByLabelText('Password'), 'long enough one');
    await userEvent.type(screen.getByLabelText('Confirm password'), 'long enough two');
    await userEvent.click(screen.getByRole('button', { name: 'Create' }));
    expect(screen.getByRole('alert').textContent).toBe('The two passwords are not the same.');
    expect(onAnswer).not.toHaveBeenCalled();
  });

  it('R3 a reopened dialog starts with empty fields', async () => {
    const { rerender } = render(<PasswordDialog purpose="unlock" onAnswer={vi.fn()} />);
    await userEvent.type(screen.getByLabelText('Password'), 'leftover');
    rerender(<PasswordDialog purpose={null} onAnswer={vi.fn()} />);
    rerender(<PasswordDialog purpose="unlock" onAnswer={vi.fn()} />);
    expect((screen.getByLabelText('Password') as HTMLInputElement).value).toBe('');
  });
});

describe('usePasswordPrompt', () => {
  it('R3 a request opens the prompt for its purpose and the answer resolves it and closes it', async () => {
    const { result } = renderHook(() => usePasswordPrompt());
    expect(result.current.purpose).toBeNull();
    let answered: unknown = 'pending';
    act(() => void result.current.requestPassword('unlock').then((answer) => (answered = answer)));
    expect(result.current.purpose).toBe('unlock');
    await act(async () => result.current.answer({ password: 'pw' }));
    expect(answered).toEqual({ password: 'pw' });
    expect(result.current.purpose).toBeNull();
  });

  it('R3 a second request while one is open cancels the first', async () => {
    const { result } = renderHook(() => usePasswordPrompt());
    let first: unknown = 'pending';
    act(() => void result.current.requestPassword('unlock').then((answer) => (first = answer)));
    await act(async () => void result.current.requestPassword('create'));
    expect(first).toBeNull();
    expect(result.current.purpose).toBe('create');
  });

  it('R3 a prompt that is unmounted while a question is open answers it with null', async () => {
    const { result, unmount } = renderHook(() => usePasswordPrompt());
    let answered: unknown = 'pending';
    act(() => void result.current.requestPassword('unlock').then((answer) => (answered = answer)));
    unmount();
    await act(async () => undefined);
    expect(answered).toBeNull();
  });

  it('R6 while requests are refused, a request answers null at once and opens nothing; afterwards requests open again', async () => {
    const { result } = renderHook(() => usePasswordPrompt());
    act(() => result.current.refuseRequests(true));
    expect(await result.current.requestPassword('unlock')).toBeNull();
    expect(result.current.purpose).toBeNull();
    act(() => result.current.refuseRequests(false));
    act(() => void result.current.requestPassword('unlock'));
    expect(result.current.purpose).toBe('unlock');
  });

  it('R3 requestPassword keeps the same identity between renders, so a vault built on it is not rebuilt', () => {
    const { result, rerender } = renderHook(() => usePasswordPrompt());
    const first = result.current.requestPassword;
    rerender();
    expect(result.current.requestPassword).toBe(first);
  });
});
