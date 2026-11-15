import { useCallback, useState } from 'react';
import type { PixelImage } from '@mat/imageops';

/**
 * Export R37, R42, R43: the emissive map of one export dialog. At most one plane exists, held in memory only; `ask` opens the emissive dialog
 * (the plane, if any, stays until Confirm replaces it), `confirm` keeps the new plane, `cancelAsk` keeps the old state, `drop` lets the plane go.
 */
export function useEmissiveDraft() {
  const [plane, setPlane] = useState<PixelImage | null>(null);
  const [asking, setAsking] = useState(false);
  const ask = useCallback(() => setAsking(true), []);
  const confirm = useCallback((next: PixelImage) => {
    setPlane(next);
    setAsking(false);
  }, []);
  const cancelAsk = useCallback(() => setAsking(false), []);
  const drop = useCallback(() => {
    setPlane(null);
    setAsking(false);
  }, []);
  return { plane, asking, ask, confirm, cancelAsk, drop };
}
