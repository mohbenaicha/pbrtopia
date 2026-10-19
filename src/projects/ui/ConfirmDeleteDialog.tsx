import { Button, Dialog } from '../../ui-kit';
import type { ProjectSummary } from '../records/projectRecords';

export interface ConfirmDeleteDialogProps {
  projects: ProjectSummary[]; // what would be deleted; the dialog is closed when empty
  progress: { done: number; total: number } | null; // set while deleting
  confirm: () => void;
  cancel: () => void;
}

// Asks before anything is deleted. Cancel comes first so it has the focus; while deleting the dialog stays until it is done.
export function ConfirmDeleteDialog({ projects, progress, confirm, cancel }: ConfirmDeleteDialogProps): React.JSX.Element {
  const deleting = progress !== null;
  const single = projects.length === 1 ? projects[0] : undefined;
  const effect = 'The model, textures, projection sets and thumbnail are removed from this browser. This cannot be undone.';
  return (
    <Dialog
      open={projects.length > 0}
      title={single ? 'Delete this project?' : `Delete ${projects.length} projects?`}
      onClose={cancel}
      dismissible={!deleting}
      actions={
        <>
          <Button variant="ghost" disabled={deleting} onClick={cancel}>Cancel</Button>
          <Button variant="danger" loading={deleting} onClick={confirm}>Delete</Button>
        </>
      }
    >
      <p>{single ? `"${single.name}": ${effect}` : `${projects.length} projects: ${effect}`}</p>
      {progress !== null && <p role="status">{`Deleted ${progress.done} of ${progress.total}`}</p>}
    </Dialog>
  );
}
