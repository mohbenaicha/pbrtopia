import { useState } from 'react';
import { Button, Disclosure } from '../../ui-kit';
import type { RunError } from '../generateStore';

export interface RunErrorBlockProps {
  error: RunError;
  onRetry: () => void;
}

// R9: why the run failed. The fixed message first; the provider's own text only as plain text in a collapsed block. Retry is offered where repeating the
// same request can help; otherwise the user changes the inputs and generates again.
export function RunErrorBlock({ error, onRetry }: RunErrorBlockProps): React.JSX.Element {
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
    </div>
  );
}
