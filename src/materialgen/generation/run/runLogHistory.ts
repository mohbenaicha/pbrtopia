import type { DescribeAttempt, ImageAttempt, RunReport, RunStatus } from './runTypes';

/** R68: one row per run, memory only. */
export interface RunLogRow {
  id: string;
  startedAt: number;
  userText: string;
  planSummary: string;
  attempts: ImageAttempt[]; // R69: a retry adds its attempts to the same row, after the failed ones
  describeAttempts: DescribeAttempt[];
  message: string;
  status: RunStatus;
}

export const MAX_LOGGED_RUNS = 10; // proposal (R68)

export interface NewRunRow {
  id: string;
  startedAt: number;
  userText: string;
  planSummary: string;
}

const describeRows = (report: RunReport): DescribeAttempt[] => (report.describeAttempt === null ? [] : [report.describeAttempt]);

/** R68: a finished run becomes the newest row; only the last ten are kept. */
export function recordRun(history: readonly RunLogRow[], run: NewRunRow, report: RunReport): RunLogRow[] {
  const row: RunLogRow = { ...run, attempts: report.attempts, describeAttempts: describeRows(report), message: report.message, status: report.status };
  return [row, ...history].slice(0, MAX_LOGGED_RUNS);
}

/** R69: a retried run keeps both attempts: the retry's attempts follow the failed ones in the row of the run it continues. */
export function recordRetry(history: readonly RunLogRow[], rowId: string, report: RunReport): RunLogRow[] {
  return history.map((row) =>
    row.id === rowId
      ? { ...row, attempts: [...row.attempts, ...report.attempts], describeAttempts: [...row.describeAttempts, ...describeRows(report)], message: report.message, status: report.status }
      : row,
  );
}
