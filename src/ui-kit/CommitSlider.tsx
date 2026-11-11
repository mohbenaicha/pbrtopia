import { useCallback, useEffect, useRef, useState } from 'react';
import { Slider } from './Slider';

interface CommitSliderProps {
  label: string; // the accessible name, e.g. "Roughness of Brick" (masks R57)
  value: number; // the saved value
  onCommit: (value: number) => void | Promise<unknown>;
  disabled?: boolean;
  layout?: 'stacked' | 'row'; // as the Slider's
  resetTo?: number; // the default: the reset arrow saves it at once (a click is a release)
  /** The range and the readout; a row value by default: 0 to 1 in steps of 0.01 with two decimals. */
  range?: { min: number; max: number; step: number; format: (value: number) => string };
}

const ROW_VALUE_RANGE = { min: 0, max: 1, step: 0.01, format: (value: number): string => value.toFixed(2) };

/**
 * Masks R50, R51: a 0 to 1 slider in steps of 0.01 whose readout follows the pointer or the keys at once but whose value is saved only when
 * the person lets go: pointer up (anywhere on the page), pointer cancel, key up, or focus leaving with a change pending. A drag that ends on
 * the value it started from saves nothing.
 */
export function CommitSlider({ label, value, onCommit, disabled = false, layout = 'stacked', range = ROW_VALUE_RANGE, resetTo }: CommitSliderProps): React.JSX.Element {
  const [shown, setShown] = useState<number | null>(null); // what the person sees until the saved value takes over
  const pending = useRef<number | null>(null); // a value changed and not yet saved
  const latest = useRef({ value, onCommit });
  latest.current = { value, onCommit };

  const commit = useCallback((next: number): void => {
    pending.current = null;
    if (next === latest.current.value) return setShown(null);
    void Promise.resolve(latest.current.onCommit(next)).finally(() => setShown(null));
  }, []);
  const finish = useCallback((): void => {
    if (pending.current !== null) commit(pending.current);
  }, [commit]);

  const releaseListener = useRef<(() => void) | null>(null);
  const stopListening = useCallback((): void => {
    releaseListener.current?.();
    releaseListener.current = null;
  }, []);
  const startListening = useCallback((): void => {
    stopListening();
    const onRelease = (): void => {
      stopListening();
      finish();
    };
    window.addEventListener('pointerup', onRelease);
    window.addEventListener('pointercancel', onRelease);
    releaseListener.current = () => {
      window.removeEventListener('pointerup', onRelease);
      window.removeEventListener('pointercancel', onRelease);
    };
  }, [finish, stopListening]);
  useEffect(() => stopListening, [stopListening]);

  return (
    <div style={{ minWidth: 0 }} onPointerDown={disabled ? undefined : startListening} onKeyUp={finish} onBlur={finish}>
      <Slider
        label={label}
        value={shown ?? value}
        min={range.min}
        max={range.max}
        step={range.step}
        disabled={disabled}
        format={range.format}
        layout={layout}
        {...(resetTo === undefined ? {} : { resetTo, onReset: () => { setShown(resetTo); commit(resetTo); } })}
        onChange={(next) => {
          pending.current = next;
          setShown(next);
        }}
      />
    </div>
  );
}
