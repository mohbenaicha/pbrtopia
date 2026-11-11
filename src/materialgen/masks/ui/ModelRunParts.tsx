import { useState } from 'react';
import { Button, ConfirmDialog } from '@shared/ui-kit';
import type { MasksModelControls } from './MasksPanel';

interface NoticeProps {
  model: MasksModelControls;
  /** Changes are off (read-only project, or another operation is running). */
  locked: boolean;
}

/** Masks R67, R68: while a model call runs, a message with Cancel; after a failure, the failed step with Retry. */
export function ModelRunNotice({ model, locked }: NoticeProps): React.JSX.Element | null {
  if (model.running) {
    return (
      <div className="masks-panel__notice" role="status">
        <p>Building the masks with the image models</p>
        <div className="masks-panel__actions">
          <Button onClick={model.onCancel}>Cancel</Button>
        </div>
      </div>
    );
  }
  if (model.error === null) return null;
  return (
    <div className="masks-panel__notice" role="alert">
      <p>{model.error}</p>
      <div className="masks-panel__actions">
        {model.canRetry && <Button disabled={locked} onClick={model.onRetry}>Retry</Button>}
      </div>
    </div>
  );
}

interface RerunProps {
  model: MasksModelControls;
  locked: boolean;
  lockedReason: string | undefined;
}

/** Masks R66: Re-run decomposition asks first, naming the models, the paid calls and that the rows the person changed are replaced. */
export function RerunDecompositionButton({ model, locked, lockedReason }: RerunProps): React.JSX.Element {
  const [asking, setAsking] = useState(false);
  const reason = model.disabledReason ?? lockedReason;
  const off = locked || model.running || model.disabledReason !== null;
  return (
    <>
      <Button disabled={off} {...(reason === undefined ? {} : { title: reason })} onClick={() => setAsking(true)}>Re-run decomposition</Button>
      <ConfirmDialog
        open={asking}
        title="Re-run the decomposition?"
        confirmLabel="Re-run"
        busy={false}
        onCancel={() => setAsking(false)}
        onConfirm={() => {
          setAsking(false);
          model.onRerun();
        }}
      >
        <p>{`This asks ${model.modelNames} again and makes up to 4 calls that cost money. The new labels replace the old ones, and the roughness and metal values you changed are replaced by the new defaults.`}</p>
      </ConfirmDialog>
    </>
  );
}
