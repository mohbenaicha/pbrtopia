import { useRef, useState } from 'react';
import { Button, Dialog, Spinner } from '../../ui-kit';
import { DEFAULT_BRUSH_SIZE, clampBrushSize, stepBrushSize, type EditorSettings } from '../stroke/settings';
import { CanvasStage, type StageHandle } from './CanvasStage';
import { Toolbar } from './Toolbar';
import { useEditorLifecycle, type EditResult } from './useEditorLifecycle';
import './referenceEditor.css';

interface ReferenceEditorDialogProps {
  source: Blob;
  width: number;
  height: number;
  name: string;
  /** The edited picture; called once, then the dialog is done. */
  onApply: (result: EditResult) => void;
  onClose: () => void;
}

const INITIAL_SETTINGS: EditorSettings = { tool: 'paint', colour: 0xff000000, brushSize: DEFAULT_BRUSH_SIZE };

/** The image editor for one reference picture: a large modal with the tools, the canvas, Apply and Cancel. Esc belongs to the editor, so the dialog is not dismissible. */
export function ReferenceEditorDialog({ source, width, height, name, onApply, onClose }: ReferenceEditorDialogProps): React.JSX.Element {
  const stage = useRef<StageHandle | null>(null);
  const [settings, setSettings] = useState<EditorSettings>(INITIAL_SETTINGS);
  const [, setRevision] = useState(0);
  const refresh = (): void => setRevision((n) => n + 1);
  const encode = (): Promise<Blob> => (stage.current === null ? Promise.reject(new Error('no canvas')) : stage.current.flushAndEncode());
  const { state, doc, message, apply, cancel } = useEditorLifecycle({ source, width, height, encode, onApply, onClose });

  const editing = doc !== null && (state === 'ready' || state === 'applying');
  const canApply = state === 'ready' && (stage.current?.accepts('apply') ?? true);
  const actions = (
    <>
      <Button onClick={() => { if (stage.current?.accepts('cancel') ?? true) cancel(); }} disabled={state === 'closing' || state === 'closed'}>Cancel</Button>
      <Button variant="primary" loading={state === 'applying'} disabled={!canApply && state !== 'applying'} onClick={() => { if (stage.current?.accepts('apply') ?? true) apply(); }}>Apply</Button>
    </>
  );

  return (
    <Dialog open title={`Edit ${name}`} size="large" dismissible={false} onClose={cancel} actions={actions}>
      <div className="reference-editor" aria-label={`Edit ${name}`}>
        {editing && (
          <>
            <Toolbar
              settings={settings}
              state={{ hasSelection: doc.hasSelection, canUndo: doc.canUndo, canRedo: doc.canRedo, droppedOlder: doc.droppedOlder }}
              stage={stage}
              onSettings={setSettings}
              onChanged={refresh}
            />
            <CanvasStage doc={doc} settings={settings} onChanged={refresh} onBrushStep={(direction) => setSettings((s) => ({ ...s, brushSize: stepBrushSize(s.brushSize, direction) }))} onBrushSize={(size) => setSettings((s) => ({ ...s, brushSize: clampBrushSize(size) }))} handleRef={stage} />
          </>
        )}
        {state === 'loading' && <Spinner label="Opening the picture" />}
        {message !== null && <p className="reference-editor__message" role="alert">{message}</p>}
      </div>
    </Dialog>
  );
}
