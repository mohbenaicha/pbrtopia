import { Button } from '@shared/ui-kit';

interface OpActionsProps {
  canApply: boolean;
  applying: boolean;
  applyLabel?: string; // Apply for a filter or tool, Generate for the AO tool (imageops R43)
  onReset: () => void;
  onCancel: () => void;
  onApply: () => void;
}

/** Imageops R17: the footer of every op dialog: Reset, Cancel and Apply (no confirmation step). */
export function OpActions({ canApply, applying, applyLabel = 'Apply', onReset, onCancel, onApply }: OpActionsProps): React.JSX.Element {
  return (
    <>
      <Button variant="ghost" disabled={applying} onClick={onReset}>Reset</Button>
      <Button variant="secondary" disabled={applying} onClick={onCancel}>Cancel</Button>
      <Button variant="primary" loading={applying} disabled={!canApply} onClick={onApply}>{applyLabel}</Button>
    </>
  );
}
