import { Button, Dialog } from '@shared/ui-kit';
import type { PackageProgress } from '../../masks/package/downloadMasksPackage';
import { MASKS_PACKAGE_BYTES } from '../../masks/package/masksPackageManifest';
import './masksPackageDialog.css';

export type MasksPackagePhase = 'asking' | 'downloading' | 'failed';

interface Props {
  phase: MasksPackagePhase | null;
  progress: PackageProgress;
  onDownload: () => void;
  onCancel: () => void; // the question: go on with the keyword match
  onCancelDownload: () => void;
  onContinue: () => void; // after a failure
}

const megabytes = (bytes: number): string => (bytes / 1e6).toFixed(1);

/** Masks-package R7-R9: the question before a metal-roughness run, the progress of the download, and the one line after a failure. */
export function MasksPackageDialog({ phase, progress, onDownload, onCancel, onCancelDownload, onContinue }: Props): React.JSX.Element {
  if (phase === 'failed') {
    return (
      <Dialog open title="Masks package" onClose={onContinue} actions={<Button variant="primary" onClick={onContinue}>Continue</Button>}>
        <p>The masks package could not be downloaded. Masks will use keyword matching.</p>
      </Dialog>
    );
  }
  if (phase === 'downloading') {
    return (
      <Dialog open title="Downloading the masks package" onClose={onCancelDownload} closeOnOutsideClick={false} actions={<Button variant="ghost" onClick={onCancelDownload}>Cancel</Button>}>
        <div className="masks-package__progress" role="status">
          <progress value={progress.loaded} max={progress.total} aria-label="Download progress" />
          <span>{megabytes(progress.loaded)} of {megabytes(progress.total)} MB</span>
        </div>
      </Dialog>
    );
  }
  return (
    <Dialog
      open={phase === 'asking'}
      title="Download the masks package?"
      onClose={onCancel}
      closeOnOutsideClick={false}
      actions={
        <>
          <Button variant="ghost" onClick={onCancel}>Cancel</Button>
          <Button variant="primary" onClick={onDownload}>Download</Button>
        </>
      }
    >
      <p>
        Choosing each mask's base material by meaning needs two files, {megabytes(MASKS_PACKAGE_BYTES)} MB together: the model (from Hugging Face) and its runtime (from jsDelivr). They are downloaded once and kept on this device.
      </p>
      <p>If you cancel, the run goes on and each mask's metal and roughness values are chosen by keyword matching, which is less accurate.</p>
    </Dialog>
  );
}
