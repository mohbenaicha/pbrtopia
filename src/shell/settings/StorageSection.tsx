import { useState } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { describeStorageShortage, formatBytes } from '../../projects/storage/storageText';
import { ImportProjectButton, ImportProjectStatus, type ProjectImportState } from '../../projects/ui/ImportProjectButton';
import { Button, ConfirmDialog } from '../../ui-kit';
import { useStorageWarning } from '../useStorageWarning';
import { usePurgeAllProjects } from './usePurgeAllProjects';
import { SettingsGroup } from './SettingsGroup';
import { SettingsPage } from './SettingsPage';
import { SettingsRow } from './SettingsRow';

interface StorageSectionProps {
  store: Pick<SharedProjectStore, 'estimateStorage' | 'requestPersistence' | 'listProjects' | 'deleteProjects' | 'saveAppSettings'>;
  projectImport: ProjectImportState; // the app's single import, shared with the project list
  deleteAllText: string; // what Delete all data removes, as the app names its own data (settings R13)
  note?: string; // a closing line about data kept elsewhere (materialgen app R45)
}

const KEPT = "Your browser will keep this site's data.";
const NOT_KEPT = 'The browser did not agree (or does not support it). Export your projects to keep copies.';

// Settings R10, R11 and R13: browser storage usage and deleting all of it, asking the browser to keep the data, and the shared Import control.
export function StorageSection({ store, projectImport, deleteAllText, note }: StorageSectionProps): React.JSX.Element {
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
    <SettingsPage title="Storage" description="How much browser storage your projects use, and how to keep them safe.">
      <SettingsGroup
        title="Usage"
        messages={
          <>
            {storage.warn && <p role="status">{describeStorageShortage(estimate, storage.full)}</p>}
            {purge.message !== null && <p role="status">{purge.message}</p>}
          </>
        }
      >
        <SettingsRow label="Storage used">
          <div className="storage-usage">
            <span>{estimate === null ? 'Usage unknown' : `${formatBytes(estimate.usedBytes)} of ${formatBytes(estimate.quotaBytes)} used`}</span>
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
      <SettingsGroup
        title="Keep my data"
        hint="Browsers may delete site data when space runs low. Use Export project in the top bar of an open project to make a copy of it."
        messages={answer !== null && <p role="status">{answer}</p>}
        actions={
          <Button loading={asking} onClick={() => void keepData()}>
            Keep my data
          </Button>
        }
      />
      <SettingsGroup
        title="Import project"
        hint="Imported projects appear in the project list."
        messages={<ImportProjectStatus state={projectImport} />}
        actions={<ImportProjectButton state={projectImport} showStatus={false} />}
      />
      {note !== undefined && <SettingsGroup title="Other apps" hint={note} />}
    </SettingsPage>
  );
}
