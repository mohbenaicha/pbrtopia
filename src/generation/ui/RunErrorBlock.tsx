import { useState } from 'react';
import { Button, Disclosure } from '../../ui-kit';
import type { RunError } from '../generateStore';

interface RunErrorBlockProps {
  error: RunError;
  onRetry: () => void;
  failedSheets?: number[]; // custom R29: the images (0-based) that failed
  onKeepWithout?: () => void;
  firstImageRequired?: boolean; // custom R29: the other images use the first as reference, so it cannot be dropped; false for masks (mask-generation R22)
}

// Custom R29: the label of the one action that folds the failed images ("Keep without images 3, 4"); null when none failed, or the first image failed and the others depend on it.
export function describeKeepWithout(failedSheets: number[], firstImageRequired = true): string | null {
  if (failedSheets.length === 0 || (firstImageRequired && failedSheets.includes(0))) return null;
  const numbers = failedSheets.map((index) => index + 1).sort((a, b) => a - b);
  return `Keep without image${numbers.length === 1 ? '' : 's'} ${numbers.join(', ')}`;
}

// R9: why the run failed. The fixed message first; the provider's own text only as plain text in a collapsed block. Retry is offered where repeating the
// same request can help; otherwise the user changes the inputs and generates again.
export function RunErrorBlock({ error, onRetry, failedSheets = [], onKeepWithout, firstImageRequired = true }: RunErrorBlockProps): React.JSX.Element {
  const keepLabel = onKeepWithout === undefined ? null : describeKeepWithout(failedSheets, firstImageRequired);
  const [detailsOpen, setDetailsOpen] = useState(false);
  return (
    <div className="run-error" role="alert">
      <p className="run-error__message">{error.message}</p>
      {error.retryAfterMs !== undefined && <p className="run-error__hint">Wait about {Math.ceil(error.retryAfterMs / 1000)} s before retrying.</p>}
      {error.details !== undefined && (
        <Disclosure title="Provider details" open={detailsOpen} onOpenChange={setDetailsOpen}>
          <pre className="run-error__details">{error.details}</pre>
        </Disclosure>
      )}
      {error.retryable ? <Button onClick={onRetry}>Retry</Button> : <p className="run-error__hint">Change the inputs, then press Generate.</p>}
      {keepLabel !== null && onKeepWithout !== undefined && <Button onClick={onKeepWithout}>{keepLabel}</Button>}
    </div>
  );
}
