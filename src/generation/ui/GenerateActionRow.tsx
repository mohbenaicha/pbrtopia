import type { ReactNode } from 'react';
import { Button, Icon, IconButton } from '../../ui-kit';
import type { RunStep } from '../generateStore';

interface GenerateActionRowProps {
  generateButton: ReactNode; // the Generate button (or Generate UV)
  running: boolean; // a run is going: the icon buttons are off
  runStep: RunStep | null; // the step of the run in flight; null before its first step is reported (or when none is going): the Generate button shows
  onCancel: () => void;
  customGear: boolean; // the channel has a Custom setup (custom R1)
  customOn: boolean; // Custom is the panel's mode: the Exit custom setup button shows
  onSetUpCustom: () => void;
  onExitCustom: () => void;
}

// Custom R1, generate R10: the one row of the Generate tab: the Generate button (Cancel in its place while a run is going), the Custom setup gear and, while
// Custom is on, the Exit custom setup X. The row wraps, so the icon buttons drop to a second row before the first button's text would be clipped.
export function GenerateActionRow({ generateButton, running, runStep, onCancel, customGear, customOn, onSetUpCustom, onExitCustom }: GenerateActionRowProps): React.JSX.Element {
  return (
    <div className="generate-panel__actions">
      {running && runStep !== null ? (
        <div className="generate-button">
          <Button variant="danger" onClick={onCancel}>{runStep === 'generate' ? 'Cancel (may still be billed)' : 'Cancel'}</Button>
        </div>
      ) : generateButton}
      {customGear && <IconButton label="Custom setup" icon={<Icon name="gear" />} disabled={running} onClick={onSetUpCustom} />}
      {customGear && customOn && <IconButton label="Exit custom setup" icon={<Icon name="close" />} disabled={running} onClick={onExitCustom} />}
    </div>
  );
}
