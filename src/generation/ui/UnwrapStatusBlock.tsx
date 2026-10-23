import { Button, Dialog } from '../../ui-kit';
import type { UnwrapState } from '../generateStore';

interface UnwrapStatusBlockProps {
  unwrap: UnwrapState;
  onDismissError: () => void;
}

const LABEL = 'Generating UVs';

// R17: a progress bar while the unwrap runs (a bar that never fills is shown as indeterminate), and its error message in a dialog after a failure.
export function UnwrapStatusBlock({ unwrap, onDismissError }: UnwrapStatusBlockProps): React.JSX.Element | null {
  if (unwrap.status === 'running') {
    const percent = Math.round(unwrap.fraction * 100);
    return (
      <div className="progress-steps">
        <span className="progress-steps__bar" role="progressbar" aria-label={LABEL} aria-valuemin={0} aria-valuemax={100} {...(percent > 0 ? { 'aria-valuenow': percent } : {})}>
          <span className="progress-steps__fill" data-indeterminate={percent === 0 ? '' : undefined} style={percent > 0 ? { width: `${percent}%` } : undefined} />
        </span>
        {LABEL}
      </div>
    );
  }
  if (unwrap.status === 'failed' && unwrap.error !== null) {
    return (
      <Dialog open title="Could not generate UVs" onClose={onDismissError} actions={<Button variant="primary" onClick={onDismissError}>OK</Button>}>
        <p>{unwrap.error.message}</p>
      </Dialog>
    );
  }
  return null;
}
