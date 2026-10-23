import { useState, type ReactNode } from 'react';
import { Button, Checkbox } from '../../ui-kit';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { ProjectCard } from './ProjectCard';
import { SelectionBar } from './SelectionBar';
import { useProjectList, type ListViewStore } from './useProjectList';
import './ProjectListView.css';

export type { ListViewStore } from './useProjectList';

interface ProjectListViewProps {
  store: ListViewStore;
  onOpen: (projectId: string) => void;
  headerActions?: ReactNode; // e.g. the New project button, put here by the app
  notice?: string | null;
  onDismissNotice?: () => void;
}

// The stored projects as cards: open, rename, delete one, select several, delete the selection after confirming.
export function ProjectListView({ store, onOpen, headerActions, notice = null, onDismissNotice }: ProjectListViewProps): React.JSX.Element {
  const { load, reload, rename, remove } = useProjectList(store);
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const projects = load.state === 'ready' ? load.projects : [];
  const pending = projects.filter((project) => toDelete.includes(project.id));

  const setPicked = (id: string, picked: boolean): void =>
    setSelected((current) => {
      const next = new Set(current);
      if (picked) next.add(id);
      else next.delete(id);
      return next;
    });

  const confirmDelete = async (): Promise<void> => {
    setProgress({ done: 0, total: toDelete.length });
    const failure = await remove(toDelete, (done, total) => setProgress({ done, total }));
    setProgress(null);
    setToDelete([]);
    setSelected(new Set());
    setDeleteError(failure);
  };

  return (
    <main className="project-list" data-testid="list-view">
      {notice !== null && (
        <p role="status" className="project-list__notice">
          {notice} {onDismissNotice && <Button variant="ghost" onClick={onDismissNotice}>Dismiss</Button>}
        </p>
      )}
      <header className="project-list__header">
        <h1>Projects</h1>
        {headerActions}
      </header>
      {deleteError !== null && <p role="alert" className="project-list__error">{deleteError}</p>}
      {load.state === 'loading' && <p className="project-list__message">Loading projects</p>}
      {load.state === 'failed' && (
        <div role="alert" className="project-list__error">
          {load.message} <Button onClick={() => void reload()}>Retry</Button>
        </div>
      )}
      {load.state === 'ready' && projects.length === 0 && <p className="project-list__message">No projects yet.</p>}
      {projects.length > 0 && (
        <div className="project-list__toolbar">
          <Checkbox label="Select all" checked={selected.size === projects.length} onChange={(all) => setSelected(all ? new Set(projects.map((project) => project.id)) : new Set())} />
          {selected.size > 0 && <SelectionBar count={selected.size} deleteSelected={() => setToDelete([...selected])} clear={() => setSelected(new Set())} />}
        </div>
      )}
      <ul className="project-list__cards">
        {projects.map((summary) => (
          <ProjectCard
            key={summary.id}
            summary={summary}
            selected={selected.has(summary.id)}
            renaming={renamingId === summary.id}
            loadThumbnail={store.loadThumbnail}
            open={() => onOpen(summary.id)}
            toggleSelected={(picked) => setPicked(summary.id, picked)}
            startRename={() => setRenamingId(summary.id)}
            saveName={async (name) => {
              const failure = await rename(summary.id, name);
              if (failure === null) setRenamingId((current) => (current === summary.id ? null : current));
              return failure;
            }}
            cancelRename={() => setRenamingId(null)}
            remove={() => setToDelete([summary.id])}
          />
        ))}
      </ul>
      <ConfirmDeleteDialog projects={pending} progress={progress} confirm={() => void confirmDelete()} cancel={() => setToDelete([])} />
    </main>
  );
}
