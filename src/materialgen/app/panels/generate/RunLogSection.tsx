import { useState } from 'react';
import { RunLogPicture } from '@shared/generation';
import { Button, Disclosure } from '@shared/ui-kit';
import type { ImageAttempt, RunLogRow } from '@mat/generation';

const pad = (value: number): string => String(value).padStart(2, '0');

function formatClock(startedAt: number): string {
  const time = new Date(startedAt);
  return `${pad(time.getHours())}:${pad(time.getMinutes())}:${pad(time.getSeconds())}`;
}

const describeStatus = (status: ImageAttempt['status']): string => ({ done: 'Done', failed: 'Failed', cancelled: 'Cancelled', skipped: 'Skipped' })[status];

function AttemptView({ attempt, number }: { attempt: ImageAttempt; number: number }): React.JSX.Element {
  const [copied, setCopied] = useState(false);
  const copy = (): void => {
    void navigator.clipboard.writeText(attempt.prompt).then(() => setCopied(true), () => setCopied(false));
  };
  const facts = [
    attempt.maps.join(', '), attempt.model, attempt.resolutionKey, attempt.quality ?? '', attempt.canvas, attempt.layout, `tile ${attempt.tilePx} px`,
    attempt.referenceNames.length === 0 ? 'no references' : `references: ${attempt.referenceNames.join(', ')}`,
    attempt.returnedSize === null ? '' : `${attempt.mimeType ?? ''} ${attempt.returnedSize}`.trim(), `${(attempt.durationMs / 1000).toFixed(1)} s`,
  ].filter((fact) => fact !== '');
  return (
    <li className="run-log__attempt" aria-label={`Attempt ${number}: ${attempt.label}`}>
      <p className="run-log__attempt-title">{attempt.label}: {describeStatus(attempt.status)}</p>
      <p className="material-panel__hint">{facts.join(' · ')}</p>
      {attempt.note !== null && <p className="material-panel__hint">{attempt.note}</p>}
      {attempt.error !== null && <p className="run-log__error">{attempt.error}</p>}
      {attempt.thumbnail !== null && <RunLogPicture blob={attempt.thumbnail} label={attempt.label} alt={`Image returned for ${attempt.label}`} fileStem={`returned-${number}`} />}
      <pre className="run-log__prompt">{attempt.prompt}</pre>
      <Button onClick={copy}>{copied ? 'Copied' : 'Copy prompt'}</Button>
    </li>
  );
}

function RunRow({ row, open, onOpenChange }: { row: RunLogRow; open: boolean; onOpenChange(open: boolean): void }): React.JSX.Element {
  return (
    <Disclosure title={`${formatClock(row.startedAt)} · ${row.planSummary} · ${row.status}`} open={open} onOpenChange={onOpenChange}>
      <p className="material-panel__hint">{row.message}</p>
      {row.userText.trim() !== '' && <p className="run-log__text">{row.userText}</p>}
      {row.describeAttempts.map((attempt, index) => (
        <p key={index} className="material-panel__hint">
          Describe step: {describeStatus(attempt.status)}, {(attempt.durationMs / 1000).toFixed(1)} s{attempt.answerLength === null ? '' : `, ${attempt.answerLength} characters`}{attempt.error === null ? '' : `, ${attempt.error}`}
        </p>
      ))}
      <ul className="run-log__attempts">
        {row.attempts.map((attempt, index) => (
          <AttemptView key={`${attempt.jobId}-${index}`} attempt={attempt} number={index + 1} />
        ))}
      </ul>
    </Disclosure>
  );
}

/** Generation R68, R69: the last ten runs of this tab, newest first, each with its images' facts, thumbnails and the prompts exactly as sent (with Copy). */
export function RunLogSection({ log }: { log: readonly RunLogRow[] }): React.JSX.Element {
  const [openId, setOpenId] = useState<string | null>(null);
  if (log.length === 0) return <p className="material-panel__hint">Runs of this session appear here.</p>;
  return (
    <div className="run-log">
      {log.map((row) => (
        <RunRow key={row.id} row={row} open={openId === row.id} onOpenChange={(open) => setOpenId(open ? row.id : null)} />
      ))}
    </div>
  );
}
