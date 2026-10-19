import { Button } from '../../ui-kit';
import type { StorageEstimate } from '../storage/storageHealth';
import './QuotaWarning.css';

export interface QuotaWarningProps {
  estimate: StorageEstimate | null;
  full: boolean; // a save has failed because the browser is out of space
  onExport: () => void;
  exporting: boolean;
  error: string | null; // why the last export failed
}

const KIB = 1024;
const UNITS = ['KB', 'MB', 'GB', 'TB'];

function formatBytes(bytes: number): string {
  let value = Math.max(0, bytes) / KIB;
  let unit = 0;
  while (value >= KIB && unit < UNITS.length - 1) {
    value /= KIB;
    unit += 1;
  }
  const text = Number.isInteger(Math.round(value * 10) / 10) ? String(Math.round(value)) : value.toFixed(1);
  return `${text} ${UNITS[unit]}`;
}

function describe(estimate: StorageEstimate | null, full: boolean): string {
  if (full || estimate === null) return 'Browser storage is full, so changes cannot be saved.';
  return `Browser storage is almost full: ${formatBytes(estimate.quotaBytes - estimate.usedBytes)} free of ${formatBytes(estimate.quotaBytes)}.`;
}

// Warns that browser storage is nearly or completely used and offers to export the open project as a zip to keep a copy.
export function QuotaWarning({ estimate, full, onExport, exporting, error }: QuotaWarningProps): React.JSX.Element {
  return (
    <div className="quota-warning" role="status">
      <p className="quota-warning__text">{describe(estimate, full)} Export the project to keep a copy, then delete projects you no longer need.</p>
      <Button loading={exporting} onClick={onExport}>
        Export project
      </Button>
      {error !== null && (
        <p role="alert" className="quota-warning__error">
          {error}
        </p>
      )}
    </div>
  );
}
