import { useState } from 'react';
import { Button, Dialog, TextInput } from '../../ui-kit';
import { keyFailure } from '../keyError';
import { MIN_PASSWORD_LENGTH } from '../KeyVault';
import type { PasswordAnswer } from '../vaultTypes';
import type { PasswordPurpose } from './usePasswordPrompt';
import './keysUi.css';

export interface PasswordDialogProps {
  purpose: PasswordPurpose | null; // null = closed
  onAnswer: (answer: PasswordAnswer | null) => void; // null = cancelled
  onForgotPassword?: (() => void) | undefined; // the link shown when unlocking
}

interface Problem {
  field: 'password' | 'confirm';
  text: string;
}

// R3: asks for the password (unlock) or a new password with its confirmation (create). Fields start empty each time it opens.
export function PasswordDialog({ purpose, onAnswer, onForgotPassword }: PasswordDialogProps): React.JSX.Element | null {
  if (purpose === null) return null;
  return <PasswordForm purpose={purpose} onAnswer={onAnswer} onForgotPassword={onForgotPassword} />;
}

interface PasswordFormProps {
  purpose: PasswordPurpose;
  onAnswer: (answer: PasswordAnswer | null) => void;
  onForgotPassword: (() => void) | undefined;
}

function PasswordForm({ purpose, onAnswer, onForgotPassword }: PasswordFormProps): React.JSX.Element {
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [problem, setProblem] = useState<Problem | null>(null);
  const creating = purpose === 'create';

  const submit = (): void => {
    if (!creating) {
      if (password !== '') onAnswer({ password });
      return;
    }
    if (password.length < MIN_PASSWORD_LENGTH) {
      setProblem({ field: 'password', text: keyFailure('weak-password').error.message });
    } else if (password !== confirm) {
      setProblem({ field: 'confirm', text: keyFailure('password-mismatch').error.message });
    } else {
      onAnswer({ password, confirm });
    }
  };

  const actions = (
    <>
      {!creating && onForgotPassword && <Button variant="ghost" onClick={onForgotPassword}>Forgot password</Button>}
      <Button onClick={() => onAnswer(null)}>Cancel</Button>
      <Button variant="primary" onClick={submit}>{creating ? 'Create' : 'Unlock'}</Button>
    </>
  );

  return (
    <Dialog open title={creating ? 'Choose a password' : 'Enter your password'} onClose={() => onAnswer(null)} actions={actions}>
      <form
        className="key-dialog__form"
        onSubmit={(event) => {
          event.preventDefault();
          submit();
        }}
      >
        {creating && <p className="key-dialog__text">This password encrypts your keys. It cannot be recovered if you forget it.</p>}
        <TextInput
          label="Password"
          type="password"
          value={password}
          onChange={setPassword}
          {...(problem?.field === 'password' ? { error: problem.text } : {})}
        />
        {creating && (
          <TextInput
            label="Confirm password"
            type="password"
            value={confirm}
            onChange={setConfirm}
            {...(problem?.field === 'confirm' ? { error: problem.text } : {})}
          />
        )}
        <button type="submit" hidden />
      </form>
    </Dialog>
  );
}
