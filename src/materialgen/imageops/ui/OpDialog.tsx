import type { ReactNode } from 'react';
import { CompareStage, Dialog, type CompareSource } from '@shared/ui-kit';
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
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  children: ReactNode; // the controls
}

/** Imageops R17, R50: the panel of an op session: the before and after pictures beside the controls, and Reset, Cancel and Apply. */
export function OpDialog({ title, sources, canApply, applying, applyLabel = 'Apply', error, onReset, onCancel, onApply, children }: OpDialogProps): React.JSX.Element {
  return (
    <Dialog
      open
      size="large"
      title={title}
      dismissible={!applying} // Escape and a click outside do not cancel a save that is running
      onClose={onCancel}
      actions={<OpActions canApply={canApply} applying={applying} applyLabel={applyLabel} onReset={onReset} onCancel={onCancel} onApply={onApply} />}
    >
      <div className="op-dialog">
        <div className="op-dialog__picture"><CompareStage sources={sources} /></div>
        <div className="op-dialog__controls">
          {error !== null && <p className="op-dialog__error" role="alert">{error}</p>}
          {children}
        </div>
      </div>
    </Dialog>
  );
}
