import { ExportDialog, type ExportDialogState } from './ExportDialog';

/** Materialgen app R11, export R20, R36: why the top bar's Export material icon cannot open the dialog now, or null when it can. */
export function exportUnavailableReason(dialog: ExportDialogState): string | null {
  return dialog.canExport ? null : 'There is nothing to export yet.';
}

/** Export R20, R34, R36: the export dialog and the message after a successful export, under the Maps section. */
export function ExportSection({ dialog }: { dialog: ExportDialogState }): React.JSX.Element {
  return (
    <>
      {dialog.message !== null && <p className="export-section__message" role="status">{dialog.message}</p>}
      <ExportDialog dialog={dialog} />
    </>
  );
}
