import { useCallback, useRef, useState } from 'react';
import { COMMIT_FAILED_MESSAGE } from '@mat/imageops';

export type ToolOutcome = { ok: boolean; message?: string };

/**
 * Imageops R12: runs the Apply of a tool dialog. It closes the dialog when the op worked; a failure keeps the dialog open with the reason
 * (the controller's own reason is shown by the card list, which the dialog covers, so a failure without one gets a general line). A run that
 * throws counts as a failure, and a second click while one is running does nothing.
 */
export function useToolApply<Settings>(run: (settings: Settings) => Promise<ToolOutcome>, onClose: () => void): { applying: boolean; error: string | null; apply: (settings: Settings) => Promise<void> } {
  const [applying, setApplying] = useState(false);
  const running = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const apply = useCallback(
    async (settings: Settings): Promise<void> => {
      if (running.current) return;
      running.current = true;
      setApplying(true);
      setError(null);
      try {
        const outcome = await run(settings);
        if (outcome.ok) onClose();
        else setError(outcome.message ?? COMMIT_FAILED_MESSAGE);
      } catch {
        setError(COMMIT_FAILED_MESSAGE);
      } finally {
        running.current = false;
        setApplying(false);
      }
    },
    [run, onClose],
  );
  return { applying, error, apply };
}
