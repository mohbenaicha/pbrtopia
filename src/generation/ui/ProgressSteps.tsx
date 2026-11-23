import { Icon } from '../../ui-kit';
import type { RunStep } from '../generateStore';
import { NORMAL_PROGRESS_LABELS } from '../normal/detailLevels';

interface ProgressStepsProps {
  step: RunStep;
  fraction: number; // 0-1 within the current step; 0 is shown as an indeterminate bar
  failed: boolean; // the current step is the one that failed
  onViewLog?: () => void; // R27: opens the run's log row; absent when there is no row to point at
  imageCount?: number; // custom R16: images the run requests; above 1 the generate step's fraction is the share finished and its label counts them
  normal?: boolean; // normal-map R11: a normal-map run shows its three steps (islands, height map, normal map) in place of the four
  masks?: boolean; // mask-generation R3: a mask run describes the materials in place of enhancing, and paints the masks in place of generating the image
}

const STEPS: { step: RunStep; label: string }[] = [
  { step: 'capture', label: 'Capturing views' },
  { step: 'enhance', label: 'Enhancing prompt' },
  { step: 'generate', label: 'Generating image' },
  { step: 'validate', label: 'Validating' },
];

const MASK_STEPS: { step: RunStep; label: string }[] = [
  { step: 'capture', label: 'Capturing views' },
  { step: 'describe', label: 'Describing the materials' },
  { step: 'generate', label: 'Painting the masks' },
  { step: 'validate', label: 'Validating' },
];

const NORMAL_STEPS: { step: RunStep; label: string }[] = [
  { step: 'prepare', label: NORMAL_PROGRESS_LABELS.prepare },
  { step: 'generate', label: NORMAL_PROGRESS_LABELS.generate },
  { step: 'derive', label: NORMAL_PROGRESS_LABELS.derive },
];

// R10: the four steps with a check on finished ones and a progress bar on the current one. The failed step (R9) is marked. Cancel is the panel's action row's
// (custom R1, generate R10). R27: the Enhancing prompt item, once done, and the failed item link to the run's log row.
export function ProgressSteps({ step, fraction, failed, onViewLog, imageCount = 1, normal = false, masks = false }: ProgressStepsProps): React.JSX.Element {
  const steps = normal ? NORMAL_STEPS : masks ? MASK_STEPS : STEPS;
  const current = steps.findIndex((entry) => entry.step === step);
  const percent = Math.round(Math.min(1, Math.max(0, fraction)) * 100);
  const labelOf = (entry: (typeof STEPS)[number]): string => (entry.step === 'generate' && step === 'generate' && imageCount > 1 ? `${entry.label} (${Math.round(Math.min(1, Math.max(0, fraction)) * imageCount)} of ${imageCount})` : entry.label);
  return (
    <div className="progress-steps">
      <ol className="progress-steps__list" aria-label="Progress">
        {steps.map((entry, index) => {
          const state = index < current ? 'done' : index > current ? 'pending' : failed ? 'failed' : 'active';
          return (
            <li key={entry.step} className="progress-steps__item" data-state={state}>
              <span className="progress-steps__mark" aria-hidden="true">{state === 'done' && <Icon name="check" size={12} />}{state === 'failed' && <Icon name="close" size={12} />}</span>
              {labelOf(entry)}
              {onViewLog !== undefined && (state === 'failed' || (state === 'done' && (entry.step === 'enhance' || entry.step === 'describe'))) && (
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
    </div>
  );
}
