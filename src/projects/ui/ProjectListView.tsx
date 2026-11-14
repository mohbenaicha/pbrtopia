import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Button, Checkbox } from '../../ui-kit';
import { ConfirmDeleteDialog } from './ConfirmDeleteDialog';
import { ProjectCard } from './ProjectCard';
import type { ProjectListExporter } from './listExport';
import { SelectionBar } from './SelectionBar';
import { useListExport } from './useListExport';
import { useProjectList, type ListViewStore } from './useProjectList';
import './ProjectListView.css';

export type { ListViewStore } from './useProjectList';

interface ProjectListViewProps {
  store: ListViewStore;
  onOpen: (projectId: string) => void;
  createActions?: (large: boolean) => ReactNode; // New project and Import project, put here by the app: in the header, or large in the empty state
  headerActions?: ReactNode; // what stays in the header whatever the list holds (Settings)
  status?: ReactNode; // a line under the header, e.g. the import result
  notice?: string | null;
  onDismissNotice?: () => void;
  deleteEffect?: string; // what a delete loses, in the app's words (the projection text by default)
  exporter?: ProjectListExporter; // gives each card an Export button and the selection an Export selected (app/projects R16, R17)
  refreshToken?: number; // a new value reads the list again without going through the loading state
  placeholderCount?: number; // grey cards after the real ones for projects still arriving, in place of the empty state (materialgen/default-projects R12)
}

// The stored projects as cards: open, rename, export or delete one, select several, export or delete the selection (delete after confirming).
export function ProjectListView({ store, onOpen, createActions, headerActions, status, notice = null, onDismissNotice, deleteEffect, exporter, placeholderCount = 0, refreshToken = 0 }: ProjectListViewProps): React.JSX.Element {
  const { load, reload, rename, remove } = useProjectList(store);
  const firstToken = useRef(refreshToken);
  useEffect(() => {
    if (refreshToken !== firstToken.current) void reload();
  }, [refreshToken, reload]);
  const listExport = useListExport(exporter);
  const exportRunning = listExport.activity.kind !== 'idle';
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [renamingId, setRenamingId] = useState<string | null>(null);
  const [toDelete, setToDelete] = useState<string[]>([]);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const projects = load.state === 'ready' ? load.projects : [];
  const arriving = placeholderCount > 0;
  const isEmpty = load.state === 'ready' && projects.length === 0 && !arriving;
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
        <div className="project-list__actions" role="group" aria-label="Project actions">
          {!isEmpty && createActions?.(false)}
          {headerActions}
        </div>
      </header>
      {status !== undefined && <div className="project-list__status">{status}</div>}
      {deleteError !== null && <p role="alert" className="project-list__error">{deleteError}</p>}
      {listExport.report !== null && (
        <div role={listExport.report.tone} className={listExport.report.tone === 'alert' ? 'project-list__report project-list__report--alert' : 'project-list__report'}>
          {listExport.report.lines.map((line, index) => (
            <p key={`${index}:${line}`}>{line}</p>
          ))}
        </div>
      )}
      {load.state === 'loading' && !arriving && <p className="project-list__message">Loading projects</p>}
      {load.state === 'failed' && (
        <div role="alert" className="project-list__error">
          {load.message} <Button onClick={() => void reload()}>Retry</Button>
        </div>
      )}
      {isEmpty && (
        <section className="project-list__empty" data-testid="empty-state">
          <p className="project-list__message">No projects yet.</p>
          <div className="project-list__empty-actions">{createActions?.(true)}</div>
        </section>
      )}
      {(projects.length > 0 || arriving) && (
        <div className={projects.length > 0 ? 'project-list__toolbar' : 'project-list__toolbar project-list__toolbar--reserved'} role="toolbar" aria-label="Select projects">
          <Checkbox label="Select all" hint="Ticks every project so they can be deleted together." checked={selected.size === projects.length} onChange={(all) => setSelected(all ? new Set(projects.map((project) => project.id)) : new Set())} />
          {selected.size > 0 && (
            <SelectionBar
              count={selected.size}
              deleteSelected={() => setToDelete([...selected])}
              clear={() => setSelected(new Set())}
              exportRunning={exportRunning}
              {...(exporter !== undefined && {
                exportSelected: () => listExport.exportMany(projects.filter((project) => selected.has(project.id))),
                exportProgress: listExport.activity.kind === 'batch' ? listExport.activity : null,
              })}
            />
          )}
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
            exportRunning={exportRunning}
            exporting={listExport.activity.kind === 'one' && listExport.activity.id === summary.id}
            {...(exporter !== undefined && { exportProject: () => listExport.exportOne(summary) })}
          />
        ))}
        {Array.from({ length: placeholderCount }, (_, index) => (
          <li key={`placeholder-${index}`} className="project-card project-card--placeholder" data-testid="project-card-placeholder" aria-hidden="true">
            <div className="project-card__thumbnail" />
            <p className="project-card__name">&nbsp;</p>
            <p className="project-card__meta">&nbsp;</p>
          </li>
        ))}
      </ul>
      <ConfirmDeleteDialog projects={pending} progress={progress} {...(deleteEffect !== undefined && { deleteEffect })} confirm={() => void confirmDelete()} cancel={() => setToDelete([])} />
    </main>
  );
}
