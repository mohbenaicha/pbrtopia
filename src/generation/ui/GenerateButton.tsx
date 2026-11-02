import { useState } from 'react';
import { Button, Dialog } from '../../ui-kit';
import type { GenerateAvailability } from '../generateAvailability';

interface GenerateButtonProps {
  availability: GenerateAvailability;
  onGenerate: () => void;
  onGenerateUv: () => void;
}

const CONFIRM_ABOVE = 4; // custom R1: a run of more images than this asks first

const describeImages = (count: number): string => `${count} ${count === 1 ? 'image' : 'images'}`;

// R6, R15: Generate, or Generate UV for a model with no UVs; when disabled the reason is written under it.
// Custom R1: a custom run reads Generate (custom), names its image count as the tooltip and asks first above four images.
export function GenerateButton({ availability, onGenerate, onGenerateUv }: GenerateButtonProps): React.JSX.Element {
  const [confirming, setConfirming] = useState(false);
  const unwrap = availability.action === 'generate-uv';
  const count = availability.imageCount;
  const custom = count !== undefined;
  const label = unwrap ? 'Generate UV' : custom ? 'Generate (custom)' : 'Generate';
  const click = unwrap ? onGenerateUv : custom && count > CONFIRM_ABOVE ? () => setConfirming(true) : onGenerate;
  return (
    <div className="generate-button">
      <Button variant="primary" disabled={!availability.enabled} onClick={click} {...(custom ? { title: describeImages(count) } : {})}>{label}</Button>
      {availability.reason !== null && <p className="generate-button__reason">{availability.reason}</p>}
      {custom && (
        <Dialog
          open={confirming}
          title={`Generate ${describeImages(count)}?`}
          onClose={() => setConfirming(false)}
          actions={
            <>
              <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              <Button
                variant="primary"
                onClick={() => {
                  setConfirming(false);
                  onGenerate();
                }}
              >
                Generate
              </Button>
            </>
          }
        />
      )}
    </div>
  );
}
