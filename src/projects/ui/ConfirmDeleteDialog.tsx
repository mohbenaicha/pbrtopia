import { ConfirmDialog } from '../../ui-kit';
import type { ProjectSummary } from '../records/projectRecords';

interface ConfirmDeleteDialogProps {
  projects: ProjectSummary[]; // what would be deleted; the dialog is closed when empty
  progress: { done: number; total: number } | null; // set while deleting
  confirm: () => void;
  cancel: () => void;
  deleteEffect?: string; // what is lost, in the app's words
}

export const PROJECTION_DELETE_EFFECT = 'The model, textures, projection sets and thumbnail are removed from this browser. This cannot be undone.';

// Asks before anything is deleted. Cancel comes first so it has the focus; while deleting the dialog stays until it is done.
export function ConfirmDeleteDialog({ projects, progress, confirm, cancel, deleteEffect = PROJECTION_DELETE_EFFECT }: ConfirmDeleteDialogProps): React.JSX.Element {
  const deleting = progress !== null;
  const single = projects.length === 1 ? projects[0] : undefined;
  const effect = deleteEffect;
  return (
    <ConfirmDialog
      open={projects.length > 0}
      title={single ? 'Delete this project?' : `Delete ${projects.length} projects?`}
      confirmLabel="Delete"
      busy={deleting}
      {...(progress !== null && { status: `Deleted ${progress.done} of ${progress.total}` })}
      onConfirm={confirm}
      onCancel={cancel}
    >
      <p>{single ? `"${single.name}": ${effect}` : `${projects.length} projects: ${effect}`}</p>
    </ConfirmDialog>
  );
}
