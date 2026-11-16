import { useEffect, useState } from 'react';
import { Button, TextInput, Tooltip } from '../../ui-kit';
import type { EnvKeyChoices } from '../env/EnvKeyChoices';
import type { ProviderKeySource } from '../ProviderKeySource';
import type { Provider } from '../vaultTypes';
import './keysUi.css';

interface EnvKeyRowProps {
  provider: Provider;
  label: string; // "Gemini", "OpenAI"
  example: string; // the name the field suggests
  keys: ProviderKeySource;
  choices: EnvKeyChoices;
  message: string | undefined; // the last failure of an action on this row
  rejected: string | undefined; // R11: the provider refused the key the name gives
  onMessage: (text: string | null) => void;
  onKeySaved?: (() => void) | undefined; // after a name was saved: the app checks the key it gives (R11)
}

type Found = 'checking' | 'found' | 'not-found';

/** Api-keys R13, R16, R19, R20: one provider's line in environment mode: the saved variable name and whether it can be found, and the actions on it. */
export function EnvKeyRow({ provider, label, example, keys, choices, message, rejected, onMessage, onKeySaved }: EnvKeyRowProps): React.JSX.Element {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState('');
  const [saving, setSaving] = useState(false);
  const [found, setFound] = useState<Found>('checking');
  const name = choices.nameOf(provider);

  // R20: one read when the row opens or its name changes; the answer is a yes or no, the value is dropped.
  useEffect(() => {
    if (name === undefined) return;
    let live = true;
    setFound('checking');
    void keys.checkEnvName(name).then((check) => {
      if (live) setFound(check.status === 'found' ? 'found' : 'not-found');
    });
    return () => {
      live = false;
    };
  }, [keys, name]);

  const closeField = (): void => {
    setEditing(false);
    setDraft('');
  };

  const trimmed = draft.trim();

  const save = async (): Promise<void> => {
    setSaving(true);
    onMessage(null);
    const check = await keys.checkEnvName(trimmed);
    setSaving(false);
    if (check.status === 'found') {
      choices.setName(provider, trimmed);
      closeField();
      onKeySaved?.();
    } else onMessage(check.message); // the field stays open to fix the name, as for a too-short pasted key
  };

  const cancel = (): void => {
    closeField();
    onMessage(null);
  };

  return (
    <div className="key-row" role="group" aria-label={label}>
      <div className="key-row__line">
        <Tooltip heading={label} text="The service this API key is for; its models become available once a name is saved and the variable is found."><span className="key-row__name">{label}</span></Tooltip>
        <span className="key-row__value">{name === undefined ? 'Not set' : `Environment: ${name}`}</span>
        {name !== undefined && <span className="key-row__status">{found === 'checking' ? 'Checking' : found === 'found' ? 'Found' : 'Not found'}</span>}
        <span className="key-row__actions">
          {!editing && (
            <>
              <Button onClick={() => setEditing(true)}>{name === undefined ? 'Add name' : 'Replace'}</Button>
              {name !== undefined && <Button variant="ghost" onClick={() => choices.clearName(provider)}>Remove</Button>}
            </>
          )}
        </span>
      </div>
      {name !== undefined && rejected && <p className="key-row__problem">{rejected}</p>}
      {!editing && message && <p className="key-row__problem" role="alert">{message}</p>}
      {editing && (
        <div className="key-row__edit">
          <TextInput
            label={`${label} environment variable name`}
            tip={`The name of the Windows environment variable that holds your ${label} API key. The key is read from it each time it is used and is never saved by the app.`}
            placeholder={example}
            value={draft}
            onChange={setDraft}
            disabled={saving}
            {...(message ? { error: message } : {})}
          />
          <div className="key-row__actions">
            <Button variant="primary" loading={saving} disabled={trimmed === ''} onClick={() => void save()}>Save</Button>
            {!saving && <Button onClick={cancel}>Cancel</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
