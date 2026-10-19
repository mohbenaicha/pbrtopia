import { useEffect, useRef, useState, type FormEvent, type KeyboardEvent } from 'react';
import { Button, TextInput } from '../../ui-kit';
import { normalizeProjectName } from '../records/projectRecords';

export interface RenameFieldProps {
  initialName: string;
  save: (name: string) => Promise<string | null>; // resolves to an error message, or null when the name was kept
  cancel: () => void;
}

const NAME_MESSAGE = 'Enter a name of 1 to 120 characters.';

// Inline rename: Enter or Save keeps the name, Escape or Cancel drops the edit. A refused name or a failed save stays open with its message.
export function RenameField({ initialName, save, cancel }: RenameFieldProps): React.JSX.Element {
  const [value, setValue] = useState(initialName);
  const [error, setError] = useState<string | undefined>(undefined);
  const [saving, setSaving] = useState(false);
  const form = useRef<HTMLFormElement>(null);

  useEffect(() => {
    form.current?.querySelector('input')?.focus();
  }, []);

  const submit = async (event: FormEvent): Promise<void> => {
    event.preventDefault();
    if (saving) return;
    const name = normalizeProjectName(value);
    if (name === null) return setError(NAME_MESSAGE);
    setSaving(true);
    const failure = await save(name);
    setSaving(false);
    if (failure !== null) setError(failure);
  };

  const cancelOnEscape = (event: KeyboardEvent): void => {
    if (event.key === 'Escape') cancel();
  };

  return (
    <form ref={form} className="project-rename" onSubmit={(event) => void submit(event)} onKeyDown={cancelOnEscape}>
      <TextInput label="Project name" value={value} onChange={setValue} disabled={saving} {...(error === undefined ? {} : { error })} />
      <div className="project-rename__actions">
        <Button variant="primary" type="submit" loading={saving}>Save</Button>
        <Button variant="ghost" onClick={cancel}>Cancel</Button>
      </div>
    </form>
  );
}
