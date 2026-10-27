import { useEffect, useRef, useState } from 'react';
import type { RunLogRecord } from '../runLogStore';
import { RunLogRow } from './RunLogRow';
import './DebugTab.css';

interface DebugTabProps {
  projectId: string;
  records: RunLogRecord[]; // newest first, every project's; this tab shows the open project's
  revealId: string | null; // R27: the row the step list's link points at
  revealCount: number; // grows on every click of that link, so the same row can be asked for again
  onRemove: (id: string) => void;
}

// R24, R26, R27: the open project's run log as rows, collapsed until opened.
export function DebugTab({ projectId, records, revealId, revealCount, onRemove }: DebugTabProps): React.JSX.Element {
  const [openIds, setOpenIds] = useState<ReadonlySet<string>>(new Set());
  const rows = useRef(new Map<string, HTMLLIElement>());
  const shown = records.filter((record) => record.projectId === projectId);

  useEffect(() => {
    if (revealId === null || !shown.some((record) => record.id === revealId)) return;
    setOpenIds((previous) => new Set(previous).add(revealId));
    const row = rows.current.get(revealId);
    if (row !== undefined && typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'start' });
  }, [revealCount]); // only a new request to reveal does this; a list that changes while the user reads it must not reopen rows

  const setOpen = (id: string, open: boolean): void =>
    setOpenIds((previous) => {
      const next = new Set(previous);
      if (open) next.add(id);
      else next.delete(id);
      return next;
    });

  if (shown.length === 0) return <p className="debug-tab__empty">No generations for this project yet.</p>;
  return (
    <ul className="debug-tab__list" aria-label="Generation log">
      {shown.map((record) => (
        <li
          key={record.id}
          className="debug-tab__row"
          ref={(element) => {
            if (element) rows.current.set(record.id, element);
            else rows.current.delete(record.id);
          }}
        >
          <RunLogRow record={record} open={openIds.has(record.id)} onOpenChange={(open) => setOpen(record.id, open)} onRemove={() => onRemove(record.id)} />
        </li>
      ))}
    </ul>
  );
}
