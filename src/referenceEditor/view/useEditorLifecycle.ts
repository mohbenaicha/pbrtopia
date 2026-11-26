import { useCallback, useEffect, useRef, useState } from 'react';
import { EditDocument } from '../document/EditDocument';
import { decodeToRaster } from '../io/decodeToRaster';
import { stepLifecycle, type LifecycleEffect, type LifecycleEvent, type LifecycleState } from '../machine/editorLifecycle';

export const OPEN_ERROR = 'This picture could not be opened for editing.';
export const APPLY_ERROR = 'The edited picture could not be saved. Try again.';
const OPEN_ERROR_MS = 2500;

export interface EditResult { blob: Blob; width: number; height: number }

interface LifecycleOptions {
  source: Blob;
  width: number;
  height: number;
  /** Encodes the picture canvas; supplied by the stage once it exists. */
  encode: () => Promise<Blob>;
  onApply: (result: EditResult) => void;
  onClose: () => void;
}

/** Drives the editor lifecycle machine: decode, apply, cancel and the late-result rules. A result is used only if its token is still current. */
export function useEditorLifecycle(options: LifecycleOptions): { state: LifecycleState; doc: EditDocument | null; message: string | null; apply: () => void; cancel: () => void } {
  const [state, setState] = useState<LifecycleState>('closed');
  const [doc, setDoc] = useState<EditDocument | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const stateRef = useRef<LifecycleState>('closed');
  const docRef = useRef<EditDocument | null>(null);
  const token = useRef(0);
  const alive = useRef(false);
  const applied = useRef(false);
  const result = useRef<EditResult | null>(null);
  const latest = useRef(options);
  latest.current = options;
  const sendRef = useRef<(event: LifecycleEvent) => void>(() => undefined);

  const run = useCallback((effect: LifecycleEffect): void => {
    const send = sendRef.current;
    switch (effect) {
      case 'decode': {
        const mine = (token.current += 1);
        decodeToRaster(latest.current.source, latest.current.width, latest.current.height).then(
          (raster) => {
            if (!alive.current || token.current !== mine) return;
            docRef.current = EditDocument.create(raster);
            setDoc(docRef.current);
            send({ t: 'opened' });
          },
          () => { if (alive.current && token.current === mine) send({ t: 'openFailed' }); },
        );
        return;
      }
      case 'showOpenError':
        setMessage(OPEN_ERROR);
        setTimeout(() => { if (alive.current) send({ t: 'acknowledged' }); }, OPEN_ERROR_MS);
        return;
      case 'encode': {
        setMessage(null);
        const mine = (token.current += 1);
        latest.current.encode().then(
          (blob) => {
            if (!alive.current || token.current !== mine || docRef.current === null) return;
            result.current = { blob, width: docRef.current.raster.width, height: docRef.current.raster.height };
            send({ t: 'applied' });
          },
          () => { if (alive.current && token.current === mine) send({ t: 'applyFailed' }); },
        );
        return;
      }
      case 'emitApply':
        applied.current = true;
        if (result.current !== null) latest.current.onApply(result.current);
        return;
      case 'showApplyError': setMessage(APPLY_ERROR); return;
      case 'discardResult': token.current += 1; return;
      case 'callOnClose': if (!applied.current) latest.current.onClose(); return;
      case 'none': return;
    }
  }, []);

  const send = useCallback((event: LifecycleEvent): void => {
    const step = stepLifecycle(stateRef.current, event);
    stateRef.current = step.state;
    setState(step.state);
    run(step.effect);
  }, [run]);
  sendRef.current = send;

  useEffect(() => {
    alive.current = true;
    send({ t: 'open' });
    return () => { alive.current = false; };
  }, [send]);

  useEffect(() => {
    if (state === 'closing') send({ t: 'closed' });
  }, [state, send]);

  const apply = useCallback(() => send({ t: 'apply', pixelChanged: docRef.current?.pixelChanged ?? false }), [send]);
  const cancel = useCallback(() => { token.current += 1; send({ t: 'cancel' }); }, [send]); // a decode or an encode still running is now stale
  return { state, doc, message, apply, cancel };
}
