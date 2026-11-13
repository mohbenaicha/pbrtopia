import { useState } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import type { StorageEstimate, StorageLocation } from '../../projects/storage/storageHealth';
import { describeDiskShortage, describeStorageShortage, formatBytes } from '../../projects/storage/storageText';
import { ImportProjectButton, ImportProjectStatus, type ProjectImportState } from '../../projects/ui/ImportProjectButton';
import { Button, ConfirmDialog } from '../../ui-kit';
import { useStorageWarning } from '../useStorageWarning';
import { LibraryFolderGroup } from './LibraryFolderGroup';
import { usePurgeAllProjects } from './usePurgeAllProjects';
import { SettingsGroup } from './SettingsGroup';
import { SettingsPage } from './SettingsPage';
import { SettingsRow } from './SettingsRow';

interface StorageSectionProps {
  store: Pick<SharedProjectStore, 'estimateStorage' | 'requestPersistence' | 'listProjects' | 'deleteProjects' | 'saveAppSettings'>;
  projectImport: ProjectImportState; // the app's single import, shared with the project list
  deleteAllText: string; // what Delete all data removes, as the app names its own data (settings R13)
  location?: StorageLocation; // desktop app only (storage-backends R10): the library folder replaces the browser's quota and persistence lines
}

const describeUsage = (estimate: StorageEstimate | null): string => (estimate === null ? 'Usage unknown' : `${formatBytes(estimate.usedBytes)} of ${formatBytes(estimate.quotaBytes)} used`);


const KEPT = "Your browser will keep this site's data.";
const NOT_KEPT = 'The browser did not agree (or does not support it). Export your projects to keep copies.';

// Settings R10, R11 and R13: browser storage usage and deleting all of it, asking the browser to keep the data, and the shared Import control.
export function StorageSection({ store, projectImport, deleteAllText, location }: StorageSectionProps): React.JSX.Element {
  const storage = useStorageWarning(store);
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);

  const keepData = async (): Promise<void> => {
    setAsking(true);
    const agreed = await store.requestPersistence();
    setAnswer(agreed ? KEPT : NOT_KEPT);
    setAsking(false);
  };

  const purge = usePurgeAllProjects(store, storage.check);
  const { estimate } = storage;
  return (
    <SettingsPage
      title="Storage"
      description={location === undefined ? 'Manage browser storage' : 'Where your projects are kept, and how much room is left on the disk.'}
    >
      {location !== undefined && <LibraryFolderGroup location={location} />}
      <SettingsGroup
        title="Usage"
        messages={
          <>
            {storage.warn && <p role="status">{location === undefined ? describeStorageShortage(estimate, storage.full) : describeDiskShortage(estimate, storage.full)}</p>}
            {purge.message !== null && <p role="status">{purge.message}</p>}
          </>
        }
      >
        <SettingsRow label={location === undefined ? 'Storage used' : 'Free disk space'}>
          <div className="storage-usage">
            <span>{location === undefined ? describeUsage(estimate) : estimate === null ? 'Free space unknown' : `${formatBytes(estimate.quotaBytes - estimate.usedBytes)} free`}</span>
            <Button loading={purge.checking} onClick={() => void purge.ask()}>
              Delete all data
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>
      <ConfirmDialog
        open={purge.asking !== null}
        title={`Delete all ${purge.asking ?? 0} ${purge.asking === 1 ? 'project' : 'projects'}?`}
        confirmLabel="Delete all"
        busy={purge.deleting}
        {...(purge.progress !== null && { status: `Deleted ${purge.progress.done} of ${purge.progress.total}` })}
        onConfirm={() => void purge.confirm()}
        onCancel={purge.cancel}
      >
        <p>{deleteAllText}</p>
      </ConfirmDialog>
      {location === undefined && (
        <SettingsGroup
          title="Keep my data"
          hint="Asks the browser to keep your data and not delete it when storage runs low."
          messages={answer !== null && <p role="status">{answer}</p>}
          actions={
            <Button loading={asking} onClick={() => void keepData()}>
              Keep my data
            </Button>
          }
        />
      )}
      <SettingsGroup
        title="Import project"
        hint="Imported projects appear in the project list."
        messages={<ImportProjectStatus state={projectImport} />}
        actions={<ImportProjectButton state={projectImport} showStatus={false} />}
      />
    </SettingsPage>
  );
}
