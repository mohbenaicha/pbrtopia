import { Button } from '../../ui-kit';
import type { GenerateAvailability } from '../generateAvailability';

export interface GenerateButtonProps {
  availability: GenerateAvailability;
  onGenerate: () => void;
  onGenerateUv: () => void;
}

// R6, R15: Generate, or Generate UV for a model with no UVs; when disabled the reason is written under it.
export function GenerateButton({ availability, onGenerate, onGenerateUv }: GenerateButtonProps): React.JSX.Element {
  const unwrap = availability.action === 'generate-uv';
  return (
    <div className="generate-button">
      <Button variant="primary" disabled={!availability.enabled} onClick={unwrap ? onGenerateUv : onGenerate}>{unwrap ? 'Generate UV' : 'Generate'}</Button>
      {availability.reason !== null && <p className="generate-button__reason">{availability.reason}</p>}
    </div>
  );
}
