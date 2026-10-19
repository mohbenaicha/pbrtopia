import { Button, Checkbox } from '../../ui-kit';
import type { ProjectSummary } from '../records/projectRecords';
import { RenameField } from './RenameField';
import { useThumbnailUrl } from './useThumbnailUrl';

export interface ProjectCardProps {
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
}

// One project in the list: thumbnail, name, size and last change, with selection and the actions.
export function ProjectCard({ summary, selected, renaming, loadThumbnail, open, toggleSelected, startRename, saveName, cancelRename, remove }: ProjectCardProps): React.JSX.Element {
  const thumbnail = useThumbnailUrl(loadThumbnail, summary.id);
  const changed = new Date(summary.updatedAt).toLocaleDateString('en-US', { dateStyle: 'medium' });
  return (
    <li className="project-card" data-testid="project-card" data-selected={selected ? '' : undefined}>
      <div className="project-card__thumbnail">{thumbnail !== null && <img src={thumbnail} alt={`${summary.name} thumbnail`} />}</div>
      <div className="project-card__select">
        <Checkbox label={`Select ${summary.name}`} hideLabel checked={selected} onChange={toggleSelected} />
      </div>
      {renaming ? (
        <RenameField initialName={summary.name} save={saveName} cancel={cancelRename} />
      ) : (
        <>
          <h2 className="project-card__name">{summary.name}</h2>
          <p className="project-card__meta">{`${summary.triangleCount.toLocaleString('en-US')} triangles · ${changed}`}</p>
          <div className="project-card__actions">
            <Button variant="primary" onClick={open}>Open</Button>
            <Button variant="ghost" onClick={startRename}>Rename</Button>
            <Button variant="ghost" onClick={remove}>Delete</Button>
          </div>
        </>
      )}
    </li>
  );
}
