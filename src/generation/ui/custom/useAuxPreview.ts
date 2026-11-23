import { useCallback, useEffect, useRef, useState } from 'react';
import type { CustomPlanRecord } from '../../custom/planTypes';

type AuxPreviewAsker = (plan: CustomPlanRecord) => Promise<{ ok: true; value: Blob } | { ok: false; error: string }>;

interface AuxPreview {
  busy: boolean; // the picture is being made
  picture: Blob | null; // the made picture, open in the viewer
  message: string | null; // why the last attempt failed
  show: (plan: CustomPlanRecord) => Promise<void>;
  close: () => void;
}

// Custom R51: the state of the aux card's Preview atlas button: busy while the host makes the picture, then the picture for the viewer or the failure message.
export function useAuxPreview(ask: AuxPreviewAsker | undefined): AuxPreview {
  const [busy, setBusy] = useState(false);
  const [picture, setPicture] = useState<Blob | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const show = useCallback(async (plan: CustomPlanRecord): Promise<void> => {
    if (ask === undefined || busy) return;
    setBusy(true);
    setMessage(null);
    const outcome = await ask(plan);
    if (!mounted.current) return;
    setBusy(false);
    if (outcome.ok) setPicture(outcome.value);
    else setMessage(outcome.error);
  }, [ask, busy]);

  return { busy, picture, message, show, close: () => setPicture(null) };
}
