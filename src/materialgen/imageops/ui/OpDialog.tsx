import type { ReactNode } from 'react';
import { CompareStage, Dialog, type CompareSource, type StageOverlay } from '@shared/ui-kit';
import { OpActions } from './OpActions';
import './opControls.css';

interface OpDialogProps {
  title: string;
  /** The two sides of the reveal: Before first, After second (imageops R50). */
  sources: CompareSource[];
  canApply: boolean;
  applying: boolean;
  applyLabel?: string; // Apply for a filter, Generate for the AO tool (R43)
  error: string | null;
  scope?: ReactNode; // above the controls: the mask swatches of the filter dialog (R78)
  overlay?: StageOverlay | null; // drawn over both sides of the reveal (R80)
  stacked?: boolean; // opened over another dialog: drawn on the stacked layer (viewport-layout R38)
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  children: ReactNode; // the controls
}

/** Imageops R17, R50: the panel of an op session: the before and after pictures beside the controls, and Reset, Cancel and Apply. */
export function OpDialog({ title, sources, canApply, applying, applyLabel = 'Apply', error, scope, overlay = null, stacked = false, onReset, onCancel, onApply, children }: OpDialogProps): React.JSX.Element {
  return (
    <Dialog
      open
      size="large"
      stacked={stacked}
      title={title}
      dismissible={!applying} // Escape does not cancel a save that is running
      closeOnOutsideClick={false} // viewport-layout R38: a press on the panels behind never ends an edit; only Cancel, Apply and Escape do
      onClose={onCancel}
      actions={<OpActions canApply={canApply} applying={applying} applyLabel={applyLabel} onReset={onReset} onCancel={onCancel} onApply={onApply} />}
    >
      <div className="op-dialog">
        <div className="op-dialog__picture"><CompareStage sources={sources} overlay={overlay} /></div>
        <div className="op-dialog__controls">
          {scope}
          {error !== null && <p className="op-dialog__error" role="alert">{error}</p>}
          {children}
        </div>
      </div>
    </Dialog>
  );
}
