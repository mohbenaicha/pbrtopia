import { useEffect, useRef } from 'react';
import { Checkbox, Icon, IconButton } from '../../ui-kit';
import type { ProjectSummary } from '../records/projectRecords';
import { RenameField } from './RenameField';
import { useThumbnailUrl } from './useThumbnailUrl';

interface ProjectCardProps {
  summary: ProjectSummary;
  selected: boolean;
  renaming: boolean;
  loadThumbnail: (projectId: string) => Promise<Blob | null>;
  open: () => void;
  toggleSelected: (selected: boolean) => void;
  startRename: () => void;
  saveName: (name: string) => Promise<string | null>;
  cancelRename: () => void;
  remove: () => void;
  exportProject?: () => void; // absent where the app gives no exporter
  exporting?: boolean; // this card's export is running
  exportRunning?: boolean; // some export is running: the card is not exported or deleted meanwhile
}

// One project in the list: thumbnail, name, size and last change, with selection and the actions.
export function ProjectCard({ summary, selected, renaming, loadThumbnail, open, toggleSelected, startRename, saveName, cancelRename, remove, exportProject, exporting = false, exportRunning = false }: ProjectCardProps): React.JSX.Element {
  const thumbnail = useThumbnailUrl(loadThumbnail, summary.id);
  const card = useRef<HTMLLIElement>(null);
  const wasRenaming = useRef(false);
  useEffect(() => {
    // leaving the rename field must not drop the keyboard focus: it goes back to this card's Rename button
    if (wasRenaming.current && !renaming) {
      Array.from(card.current?.querySelectorAll('button') ?? []).find((button) => button.getAttribute('aria-label') === 'Rename')?.focus();
    }
    wasRenaming.current = renaming;
  }, [renaming]);
  const unreadable = summary.unreadable === undefined ? {} : { disabled: true, disabledReason: summary.unreadable }; // a project of an older version: it can only be deleted (textures R22)
  const changed = new Date(summary.updatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' });
  const size = summary.detail ?? (summary.triangleCount === undefined ? null : `${summary.triangleCount.toLocaleString('en-US')} triangles`);
  const meta = summary.unreadable ?? [size, changed].filter((part) => part !== null).join(' · ');
  return (
    <li ref={card} className="project-card" data-testid="project-card" data-selected={selected ? '' : undefined}>
      <div className="project-card__thumbnail">{thumbnail !== null && <img src={thumbnail} alt={`${summary.name} thumbnail`} />}</div>
      <div className="project-card__select">
        <Checkbox label={`Select ${summary.name}`} hideLabel checked={selected} onChange={toggleSelected} />
      </div>
      {renaming ? (
        <RenameField initialName={summary.name} save={saveName} cancel={cancelRename} />
      ) : (
        <>
          <h2 className="project-card__name" title={summary.name}>{summary.name}</h2>
          <p className="project-card__meta">{meta}</p>
          <div className="project-card__actions">
            <IconButton label="Open" icon={<Icon name="open-project" />} {...unreadable} onClick={open} />
            <IconButton label="Rename" icon={<Icon name="pencil" />} {...unreadable} onClick={startRename} />
            {exportProject !== undefined && (
              <IconButton
                label={`Export ${summary.name}`}
                hint="Export project"
                icon={<Icon name="download" />}
                loading={exporting}
                {...(summary.unreadable === undefined ? { disabled: exportRunning && !exporting } : unreadable)}
                onClick={exportProject}
              />
            )}
            <IconButton label="Delete" icon={<Icon name="trash" />} disabled={exportRunning} onClick={remove} />
          </div>
        </>
      )}
    </li>
  );
}
