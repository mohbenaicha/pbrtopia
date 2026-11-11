import { useEffect, useId, useRef, type ReactNode } from 'react';
import { OpActions } from './OpActions';
import './opControls.css';

interface ToolPanelProps {
  title: string;
  canApply: boolean;
  applying: boolean;
  error: string | null;
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
  children: ReactNode;
}

/**
 * Imageops R52: the panel of Crop and Mirror. It sits in the left panel in place of the slot cards, so the viewport stays open and live; it is not a
 * dialog. Settings above, then Reset, Cancel and Apply. Escape cancels, except while an Apply is running.
 */
export function ToolPanel({ title, canApply, applying, error, onReset, onCancel, onApply, children }: ToolPanelProps): React.JSX.Element {
  const heading = useId();
  const state = useRef({ applying, onCancel });
  state.current = { applying, onCancel };
  useEffect(() => {
    const onKey = (event: KeyboardEvent): void => {
      if (event.key === 'Escape' && !state.current.applying) state.current.onCancel();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);
  return (
    <section className="tool-panel" aria-labelledby={heading}>
      <h3 className="tool-panel__title" id={heading}>{title}</h3>
      <div className="tool-panel__body">
        {error !== null && <p className="op-dialog__error" role="alert">{error}</p>}
        {children}
      </div>
      <div className="tool-panel__actions"><OpActions canApply={canApply} applying={applying} onReset={onReset} onCancel={onCancel} onApply={onApply} /></div>
    </section>
  );
}
