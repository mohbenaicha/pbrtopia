import { useState } from 'react';
import { Button, ConfirmDialog } from '@shared/ui-kit';

/** Masks R64-R68: the model path as the panel sees it; the app binds it to a run of the describe step and the decomposition image. */
export interface MasksModelControls {
  /** Why the model actions are off (no vision-text model, no key, no decomposition model), shown as their tooltip; null when they are available. */
  disabledReason: string | null;
  running: boolean;
  /** The failed step, named, or null (R67). */
  error: string | null;
  canRetry: boolean;
  /** The models a re-run uses, for its question (R66). */
  modelNames: string;
  onCreate(): void;
  onRerun(): void;
  onCancel(): void;
  onRetry(): void;
}

interface NoticeProps {
  model: MasksModelControls;
  /** Changes are off (read-only project). */
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

/** Masks R49, R66: the gold Re-run decomposition button; it asks first, naming the models, the paid calls and that the rows the person changed are replaced. */
export function RerunDecompositionButton({ model, locked, lockedReason }: RerunProps): React.JSX.Element {
  const [asking, setAsking] = useState(false);
  const reason = model.disabledReason ?? lockedReason;
  const off = locked || model.running || model.disabledReason !== null;
  return (
    <>
      <Button variant="primary" disabled={off} {...(reason === undefined ? {} : { title: reason })} onClick={() => setAsking(true)}>Re-run decomposition</Button>
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
        <p>{`This asks ${model.modelNames} again and makes up to 3 calls that cost money. The new labels replace the old ones, and the roughness and metal values you changed are replaced by the new defaults.`}</p>
      </ConfirmDialog>
    </>
  );
}
