import type { SyntheticEvent } from 'react';
import { Spinner } from './Spinner';
import './LoadingOverlay.css';

interface LoadingOverlayProps {
  label: string; // what is happening, e.g. "Loading model"; also the accessible name. An empty label draws nothing.
  detail?: string; // a second line under the label
  progress?: number; // a fraction 0 to 1; 0 is shown as an indeterminate bar, none draws no bar
}

const stopEvent = (event: SyntheticEvent): void => event.stopPropagation();

// A veil over the nearest positioned parent saying that something is happening there. It knows nothing about what is loading: the caller chooses the words and the progress.
export function LoadingOverlay({ label, detail, progress }: LoadingOverlayProps): React.JSX.Element | null {
  if (label === '') return null;
  const percent = progress === undefined ? null : Math.round(Math.min(1, Math.max(0, progress)) * 100);
  return (
    <div
      className="loading-overlay"
      data-testid="loading-overlay"
      role="status"
      aria-live="polite"
      aria-label={label}
      onPointerDown={stopEvent}
      onWheel={stopEvent}
      onClick={stopEvent}
      onDoubleClick={stopEvent}
      onContextMenu={stopEvent}
    >
      <div className="loading-overlay__card">
        <div className="loading-overlay__title">
          <Spinner decorative />
          <span>{label}</span>
        </div>
        {detail !== undefined && (
          <span className="loading-overlay__detail" data-testid="loading-overlay-detail">
            {detail}
          </span>
        )}
        {percent !== null && (
          <span
            className="loading-overlay__bar"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            {...(percent > 0 ? { 'aria-valuenow': percent } : { 'data-indeterminate': 'true' })}
          >
            <span className="loading-overlay__fill" data-testid="loading-overlay-fill" style={percent > 0 ? { width: `${percent}%` } : undefined} />
          </span>
        )}
      </div>
    </div>
  );
}
