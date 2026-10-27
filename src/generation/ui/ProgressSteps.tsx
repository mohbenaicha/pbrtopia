import { Button, Icon } from '../../ui-kit';
import type { RunStep } from '../generateStore';

interface ProgressStepsProps {
  step: RunStep;
  fraction: number; // 0-1 within the current step; 0 is shown as an indeterminate bar
  failed: boolean; // the current step is the one that failed
  onCancel: () => void;
  onViewLog?: () => void; // R27: opens the run's log row; absent when there is no row to point at
}

const STEPS: { step: RunStep; label: string }[] = [
  { step: 'capture', label: 'Capturing views' },
  { step: 'enhance', label: 'Enhancing prompt' },
  { step: 'generate', label: 'Generating image' },
  { step: 'validate', label: 'Validating' },
];

// R10: the four steps with a check on finished ones and a progress bar on the current one, and Cancel. After a failure (R9) the failed step is marked
// and Cancel goes away. Once the image step has started the provider may bill the request even if it is cancelled, and the button says so.
// R27: the Enhancing prompt item, once done, and the failed item link to the run's log row.
export function ProgressSteps({ step, fraction, failed, onCancel, onViewLog }: ProgressStepsProps): React.JSX.Element {
  const current = STEPS.findIndex((entry) => entry.step === step);
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  return (
    <div className="progress-steps">
      <ol className="progress-steps__list" aria-label="Progress">
        {STEPS.map((entry, index) => {
          const state = index < current ? 'done' : index > current ? 'pending' : failed ? 'failed' : 'active';
          return (
            <li key={entry.step} className="progress-steps__item" data-state={state}>
              <span className="progress-steps__mark" aria-hidden="true">{state === 'done' && <Icon name="check" size={12} />}{state === 'failed' && <Icon name="close" size={12} />}</span>
              {entry.label}
              {onViewLog !== undefined && (state === 'failed' || (state === 'done' && entry.step === 'enhance')) && (
                <button type="button" className="progress-steps__link" onClick={onViewLog}>View log</button>
              )}
              {state === 'active' && (
                <span className="progress-steps__bar" role="progressbar" aria-label={entry.label} aria-valuemin={0} aria-valuemax={100} {...(percent > 0 ? { 'aria-valuenow': percent } : {})}>
                  <span className="progress-steps__fill" data-indeterminate={percent === 0 ? '' : undefined} style={percent > 0 ? { width: `${percent}%` } : undefined} />
                </span>
              )}
            </li>
          );
        })}
      </ol>
      {!failed && <Button variant="danger" onClick={onCancel}>{step === 'generate' ? 'Cancel (may still be billed)' : 'Cancel'}</Button>}
    </div>
  );
}
