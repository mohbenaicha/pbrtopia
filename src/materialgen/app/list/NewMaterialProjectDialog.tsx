import { useState, type KeyboardEvent } from 'react';
import { normalizeProjectName } from '@shared/projects';
import { Button, Dialog, Select, TextInput } from '@shared/ui-kit';
import type { MaterialSize } from '@mat/storage';
import { AUTO_SIZE_CHOICE, SIZE_OPTIONS, sizeOfChoice } from '../project/sizeChoices';
import './NewMaterialProjectDialog.css';

interface NewMaterialProjectDialogProps {
  busy: boolean; // the project is being created: the dialog cannot be closed meanwhile
  error: string | null; // why the last attempt made no project
  onCreate(name: string, size: MaterialSize | null): void; // the name is valid and trimmed
  onCancel(): void;
}

const NAME_MESSAGE = 'Enter a name of 1 to 120 characters.';

/** Materialgen app R24, R24a: the name and the size, then Create. Enter creates; Esc, Cancel and a click outside create nothing. */
export function NewMaterialProjectDialog({ busy, error, onCreate, onCancel }: NewMaterialProjectDialogProps): React.JSX.Element {
  const [value, setValue] = useState('');
  const [choice, setChoice] = useState(AUTO_SIZE_CHOICE);
  const name = normalizeProjectName(value);
  const nameError = name === null && value.trim() !== '' ? NAME_MESSAGE : undefined;

  const create = (): void => {
    if (name !== null && !busy) onCreate(name, sizeOfChoice(choice));
  };
  const createOnEnter = (event: KeyboardEvent): void => {
    if (event.key !== 'Enter') return;
    event.preventDefault();
    create();
  };

  return (
    <Dialog
      open
      title="New project"
      onClose={onCancel}
      dismissible={!busy}
      actions={
        <>
          <Button variant="ghost" disabled={busy} onClick={onCancel}>Cancel</Button>
          <Button variant="primary" loading={busy} disabled={name === null} onClick={create}>Create</Button>
        </>
      }
    >
      <div className="new-material-dialog" onKeyDown={createOnEnter}>
        <TextInput label="Project name" placeholder="Project name" value={value} onChange={setValue} disabled={busy} {...(nameError === undefined ? {} : { error: nameError })} />
        <Select label="Size" options={SIZE_OPTIONS} value={choice} onChange={setChoice} disabled={busy} />
        {error !== null && !busy && <p className="new-material-dialog__error" role="alert">{error}</p>}
      </div>
    </Dialog>
  );
}
