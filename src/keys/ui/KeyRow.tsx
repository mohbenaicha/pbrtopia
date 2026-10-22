import { useEffect, useRef, useState } from 'react';
import { Button, TextInput } from '../../ui-kit';
import type { KeyVault } from '../KeyVault';
import type { Provider } from '../vaultTypes';
import './keysUi.css';

export interface KeyRowProps {
  provider: Provider;
  label: string; // "Gemini", "OpenAI"
  vault: KeyVault;
  message: string | undefined; // the last failure of an action on this row
  rejected: string | undefined; // R11: the provider refused the stored key
  onMessage: (text: string | null) => void;
  onKeySaved?: (() => void) | undefined; // after the vault accepted a new or replaced key (settings R3)
}

type Busy = 'saving' | 'removing' | null;

// R1, R7: one provider's line: the masked key and its status, and the actions on it (add or replace behind a masked field, remove).
export function KeyRow({ provider, label, vault, message, rejected, onMessage, onKeySaved }: KeyRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [busy, setBusy] = useState<Busy>(null);
  const hasKey = vault.hasKey(provider);
  const row = useRef<HTMLDivElement>(null);
  const wasEditing = useRef(false);

  // The control that was pressed goes away when the field opens or closes, so focus follows: into the field, and back to Add or Replace.
  useEffect(() => {
    if (editing) row.current?.querySelector<HTMLElement>('input')?.focus();
    else if (wasEditing.current) row.current?.querySelector<HTMLElement>('.key-row__actions button')?.focus();
    wasEditing.current = editing;
  }, [editing]);

  const closeField = (): void => {
    setEditing(false);
    setDraft('');
  };

  const save = async (): Promise<void> => {
    setBusy('saving');
    onMessage(null);
    const result = await vault.setKey(provider, draft);
    setBusy(null);
    if (result.ok) {
      closeField();
      onKeySaved?.();
    } else {
      // A key that is too short stays in the field to be fixed; any other failure closes it, so no key is left on the page.
      if (result.error.code !== 'invalid-key') closeField();
      onMessage(result.error.message);
    }
  };

  const remove = async (): Promise<void> => {
    setBusy('removing');
    onMessage(null);
    const result = await vault.removeKey(provider);
    setBusy(null);
    if (!result.ok) onMessage(result.error.message);
  };

  const cancel = (): void => {
    closeField();
    onMessage(null);
  };

  return (
    <div className="key-row" role="group" aria-label={label} ref={row}>
      <div className="key-row__line">
        <span className="key-row__name">{label}</span>
        <span className="key-row__value">{hasKey ? `••••${vault.hint(provider) ?? ''}` : 'Not set'}</span>
        {hasKey && <span className="key-row__status">{vault.status() === 'unlocked' ? 'Encrypted, unlocked' : 'Encrypted, locked'}</span>}
        <span className="key-row__actions">
          {!editing && (
            <>
              <Button onClick={() => setEditing(true)} disabled={busy !== null}>{hasKey ? 'Replace' : 'Add key'}</Button>
              {hasKey && <Button variant="ghost" loading={busy === 'removing'} disabled={busy !== null} onClick={() => void remove()}>Remove</Button>}
            </>
          )}
        </span>
      </div>
      {hasKey && rejected && <p className="key-row__problem">{rejected}</p>}
      {!editing && message && <p className="key-row__problem" role="alert">{message}</p>}
      {editing && (
        <div className="key-row__edit">
          <TextInput
            label={`${label} key`}
            type="password"
            value={draft}
            onChange={setDraft}
            disabled={busy === 'saving'}
            {...(message ? { error: message } : {})}
          />
          <div className="key-row__actions">
            <Button variant="primary" loading={busy === 'saving'} disabled={draft.trim() === ''} onClick={() => void save()}>Save</Button>
            {busy !== 'saving' && <Button onClick={cancel}>Cancel</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
