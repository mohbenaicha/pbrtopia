import { Button } from '../../ui-kit';

interface SelectionBarProps {
  count: number;
  deleteSelected: () => void;
  clear: () => void;
  exportSelected?: () => void; // absent where the app gives no exporter
  exportProgress?: { position: number; total: number } | null; // set while this batch runs
  exportRunning?: boolean; // any export is running: nothing is deleted or exported meanwhile
}

// Shown while projects are selected: how many, and what can be done with them.
export function SelectionBar({ count, deleteSelected, clear, exportSelected, exportProgress = null, exportRunning = false }: SelectionBarProps): React.JSX.Element {
  return (
    <div className="project-selection-bar">
      <span>{`${count} selected`}</span>
      {exportSelected !== undefined && (
        <Button loading={exportProgress !== null} disabled={exportRunning && exportProgress === null} onClick={exportSelected}>
          {exportProgress === null ? 'Export selected' : `Exporting ${exportProgress.position} of ${exportProgress.total}`}
        </Button>
      )}
      <Button variant="danger" disabled={exportRunning} onClick={deleteSelected}>Delete selected</Button>
      <Button variant="ghost" onClick={clear}>Clear</Button>
    </div>
  );
}
