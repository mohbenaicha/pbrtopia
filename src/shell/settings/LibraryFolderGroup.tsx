import { useState } from 'react';
import type { StorageLocation } from '../../projects/storage/storageHealth';
import { Button, Dialog } from '../../ui-kit';
import { SettingsGroup } from './SettingsGroup';
import { SettingsRow } from './SettingsRow';

interface LibraryFolderGroupProps {
  location: StorageLocation;
}

const BEFORE_CHANGING =
  'Your projects stay where they are. The app will open the folder you choose, with the projects already in it. Nothing is moved or copied.';

/** Storage-backends R10: the desktop app's library folder with Show in folder and Change folder (which says what it does before the native dialog opens). */
export function LibraryFolderGroup({ location }: LibraryFolderGroupProps): React.JSX.Element {
  const [asking, setAsking] = useState(false);
  const [choosing, setChoosing] = useState(false);
  const [refusal, setRefusal] = useState<string | null>(null);

  const choose = async (): Promise<void> => {
    setChoosing(true);
    setRefusal(null);
    try {
      const outcome = await location.change();
      if (typeof outcome === 'object') setRefusal(outcome.refused);
    } finally {
      setChoosing(false);
      setAsking(false);
    }
  };

  return (
    <>
      <SettingsGroup
        title="Library folder"
        hint="Where this app keeps your projects."
        messages={refusal !== null && <p role="status">{refusal}</p>}
        actions={
          <>
            <Button onClick={() => void location.showInFolder()}>Show in folder</Button>
            <Button onClick={() => setAsking(true)}>Change folder</Button>
          </>
        }
      >
        <SettingsRow label="Folder">
          <span className="library-folder__path">{location.path}</span>
        </SettingsRow>
      </SettingsGroup>
      <Dialog
        open={asking}
        title="Change the library folder?"
        onClose={() => setAsking(false)}
        dismissible={!choosing}
        actions={
          <>
            <Button variant="ghost" disabled={choosing} onClick={() => setAsking(false)}>
              Cancel
            </Button>
            <Button variant="primary" loading={choosing} onClick={() => void choose()}>
              Choose folder
            </Button>
          </>
        }
      >
        <p>{BEFORE_CHANGING}</p>
      </Dialog>
    </>
  );
}
