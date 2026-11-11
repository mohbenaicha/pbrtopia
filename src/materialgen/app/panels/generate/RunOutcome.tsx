import { Button } from '@shared/ui-kit';
import { PACKED_NOTE, type RunReport } from '@mat/generation';

interface RunOutcomeProps {
  result: RunReport | null;
  startError: string | null;
  canRetry: boolean;
  onRetry(): void;
}

/** Generation R55-R60, R65: the line after a run, or the error panel naming each failed image with Retry where repeating can help. */
export function RunOutcome({ result, startError, canRetry, onRetry }: RunOutcomeProps): React.JSX.Element | null {
  if (startError !== null) return <p className="generate-outcome generate-outcome--error" role="alert">{startError}</p>;
  if (result === null) return null;
  if (result.failures.length === 0) {
    return (
      <div className="generate-outcome" role="status">
        <p>{result.message}</p>
        {result.packedWarning && <p className="material-panel__hint">{PACKED_NOTE}</p>}
      </div>
    );
  }
  return (
    <div className="generate-outcome generate-outcome--error" role="alert">
      <p>{result.message}</p>
      <ul className="generate-outcome__failures">
        {result.failures.map((failure) => (
          <li key={failure.jobId}>{failure.message}</li>
        ))}
      </ul>
      {canRetry ? <Button onClick={onRetry}>Retry</Button> : <p className="material-panel__hint">Change the inputs, then press Generate.</p>}
    </div>
  );
}
