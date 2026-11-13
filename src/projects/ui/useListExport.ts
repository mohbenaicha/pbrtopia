import { useCallback, useRef, useState } from 'react';
import type { ProjectSummary } from '../records/projectRecords';
import type { ListExportResult, ProjectListExporter } from './listExport';

/** What the list says about the last export: a plain line, or a problem with the lines that explain it. */
export type ExportReport = { tone: 'status' | 'alert'; lines: string[] };

export type ExportActivity = { kind: 'idle' } | { kind: 'one'; id: string } | { kind: 'batch'; position: number; total: number };

const BLOCKED_DOWNLOADS = 'If your browser blocked some downloads, allow multiple downloads for this site and export again.';
const projectsOf = (count: number): string => (count === 1 ? '1 project' : `${count} projects`);

export interface ListExport {
  activity: ExportActivity;
  report: ExportReport | null;
  exportOne: (project: ProjectSummary) => void;
  exportMany: (projects: ProjectSummary[]) => void;
}

/** App/projects R16, R17: exports one project, or the selected ones in the order given, one at a time; at most one export runs at once. */
export function useListExport(exporter: ProjectListExporter | undefined): ListExport {
  const [activity, setActivity] = useState<ExportActivity>({ kind: 'idle' });
  const [report, setReport] = useState<ExportReport | null>(null);
  const running = useRef(false);

  const exportOne = useCallback(
    (project: ProjectSummary) => {
      if (exporter === undefined || running.current) return;
      running.current = true;
      setReport(null);
      setActivity({ kind: 'one', id: project.id });
      void exporter
        .exportOne({ id: project.id, name: project.name })
        .catch((error: unknown): ListExportResult => ({ kind: 'failed', message: error instanceof Error ? error.message : 'The export failed.' }))
        .then((result) => {
          if (result.kind === 'done') setReport({ tone: 'status', lines: [[`Exported ${project.name}.`, result.note].filter((part) => part !== null).join(' ')] });
          else if (result.kind === 'failed') setReport({ tone: 'alert', lines: [`${project.name}: ${result.message}`] });
        })
        .finally(() => {
          running.current = false;
          setActivity({ kind: 'idle' });
        });
    },
    [exporter],
  );

  const exportMany = useCallback(
    (projects: ProjectSummary[]) => {
      if (exporter === undefined || running.current || projects.length === 0) return;
      running.current = true;
      setReport(null);
      void (async () => {
        try {
          const batch = await exporter.openBatch();
          if (batch === null) return;
          const lines: string[] = [];
          let exported = 0;
          for (const [index, project] of projects.entries()) {
            setActivity({ kind: 'batch', position: index + 1, total: projects.length });
            if (project.unreadable !== undefined) {
              lines.push(`${project.name}: ${project.unreadable}`);
              continue;
            }
            const result = await batch
              .exportInto({ id: project.id, name: project.name })
              .catch((error: unknown): ListExportResult => ({ kind: 'failed', message: error instanceof Error ? error.message : 'The export failed.' }));
            if (result.kind === 'done') {
              exported += 1;
              if (result.note !== null) lines.push(`${project.name}: ${result.note}`);
            } else if (result.kind === 'failed') {
              lines.push(`${project.name}: ${result.message}`);
              if (result.stopBatch === true) break;
            }
          }
          const failed = lines.length > 0 && exported < projects.length;
          const summary = exported === projects.length ? `Exported ${projectsOf(exported)}.` : `Exported ${exported} of ${projectsOf(projects.length)}.`;
          setReport({ tone: failed ? 'alert' : 'status', lines: [summary, ...lines, ...(batch.toFolder ? [] : [BLOCKED_DOWNLOADS])] });
        } finally {
          running.current = false;
          setActivity({ kind: 'idle' });
        }
      })();
    },
    [exporter],
  );

  return { activity, report, exportOne, exportMany };
}
