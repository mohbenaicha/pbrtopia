import { Button } from '../../ui-kit';
import type { StorageEstimate } from '../storage/storageHealth';
import { describeDiskShortage, describeStorageShortage } from '../storage/storageText';
import './QuotaWarning.css';

export interface QuotaWarningProps {
  estimate: StorageEstimate | null;
  full: boolean; // a save has failed because the browser is out of space
  onExport: () => void;
  exporting: boolean;
  error: string | null; // why the last export failed
  exportDisabledReason?: string | null; // projects R13: why Export cannot run now (a set is open, a task runs)
  onDisk?: boolean; // the desktop app: the numbers are the disk's free space, so the words are about the disk (storage-backends R10)
}

// Warns that browser storage is nearly or completely used and offers to export the open project as a zip to keep a copy.
export function QuotaWarning({ estimate, full, onExport, exporting, error, exportDisabledReason = null, onDisk = false }: QuotaWarningProps): React.JSX.Element {
  return (
    <div className="quota-warning" role="status">
      <p className="quota-warning__text">{onDisk ? describeDiskShortage(estimate, full) : describeStorageShortage(estimate, full)} Export the project to keep a copy, then delete projects you no longer need.</p>
      <Button loading={exporting} disabled={exportDisabledReason !== null} onClick={onExport}>
        Export project
      </Button>
      {exportDisabledReason !== null && <p className="quota-warning__text">{exportDisabledReason}</p>}
      {error !== null && (
        <p role="alert" className="quota-warning__error">
          {error}
        </p>
      )}
    </div>
  );
}
