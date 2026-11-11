import { useCallback, useEffect, useRef, useState } from 'react';
import type { PixelImage } from '../gpu/pixelFormats';
import { createPreviewScheduler, type PreviewScheduler } from '../session/previewScheduler';
import type { OpSession } from '../session/opSession';
import { pixelsToPictureUrl } from './pixelPictureUrl';

export const APPLY_FAILED_MESSAGE = 'Could not apply (graphics error). Nothing changed.';
export const COMMIT_FAILED_MESSAGE = 'Could not save the result. Nothing changed.';
const PREVIEW_FAILED_MESSAGE = 'The preview could not be drawn.';

type Values = Record<string, number>;

interface UseOpSessionOptions<V extends Values> {
  /** Opens the session on the working copy; called once when the dialog mounts. */
  openSession: () => Promise<OpSession<V>>;
  defaults: V;
  /** The values the controls start at when they are not the defaults (AO starts from the parameters last used); Reset still goes to `defaults`. */
  initial?: V;
  /** Draws a first preview as soon as the session is open (AO shows its result before any control moves). */
  previewOnOpen?: boolean;
  isChanged: (values: V) => boolean;
  encodePreview?: (image: PixelImage) => Promise<string>;
  revokePreview?: (url: string) => void;
}

export interface OpSessionState<V extends Values> {
  status: 'loading' | 'ready' | 'failed';
  values: V;
  setValue: (id: string, value: number) => void;
  reset: () => void;
  /** The newest preview picture, or null before the first one is drawn. */
  previewUrl: string | null;
  canApply: boolean;
  applying: boolean;
  error: string | null;
  /**
   * Renders at S from the current values and hands the picture to `commit`; `applying` stays on until the commit has finished. True when it was
   * stored. False (with `error` set) when the render or the commit failed, nothing is committed when the session closed meanwhile or another
   * Apply is still running.
   */
  apply: (commit: (image: PixelImage) => Promise<boolean>) => Promise<boolean>;
}

/**
 * Imageops R7, R9, R12, R18, R19: one op session for the life of a dialog. It opens on mount and closes on unmount (switching away is Cancel),
 * previews through the scheduler (75 ms after the last change, newest only), and renders the final image from the values, never the preview.
 * Every render and the close go through one queue, so a render never meets a released target.
 */
export function useOpSession<V extends Values>({ openSession, defaults, initial, previewOnOpen = false, isChanged, encodePreview = pixelsToPictureUrl, revokePreview = URL.revokeObjectURL }: UseOpSessionOptions<V>): OpSessionState<V> {
  const [status, setStatus] = useState<OpSessionState<V>['status']>('loading');
  const [values, setValues] = useState<V>(initial ?? defaults);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [applying, setApplying] = useState(false);
  const applyingRef = useRef(false); // set at once by a click, before the state is drawn, so two quick clicks cannot both start
  const [error, setError] = useState<string | null>(null);
  const valuesRef = useRef<V>(initial ?? defaults);
  const startPreview = useRef(previewOnOpen);
  const session = useRef<OpSession<V> | null>(null);
  const scheduler = useRef<PreviewScheduler<V> | null>(null);
  const queue = useRef<Promise<unknown>>(Promise.resolve());
  const closed = useRef(false);
  const shown = useRef<string | null>(null);
  const encoded = useRef(0);
  const settings = useRef({ encodePreview, revokePreview });
  settings.current = { encodePreview, revokePreview };

  const enqueue = useCallback(<T,>(work: () => Promise<T>): Promise<T> => {
    const result = queue.current.then(work);
    queue.current = result.catch(() => undefined);
    return result;
  }, []);

  useEffect(() => {
    closed.current = false;
    let opened: OpSession<V> | null = null;
    const showPicture = (image: PixelImage): void => {
      encoded.current += 1;
      const id = encoded.current;
      settings.current.encodePreview(image).then(
        (url) => {
          if (closed.current || id !== encoded.current) return settings.current.revokePreview(url); // older than the newest picture, or the dialog is gone
          if (shown.current !== null) settings.current.revokePreview(shown.current);
          shown.current = url;
          setPreviewUrl(url);
          setError(null);
        },
        () => setError(PREVIEW_FAILED_MESSAGE),
      );
    };
    openSession().then(
      (value) => {
        if (closed.current) {
          value.close();
          return;
        }
        opened = value;
        session.current = value;
        scheduler.current = createPreviewScheduler<V, PixelImage>({
          render: (next) => enqueue(() => value.renderPreview(next)),
          show: showPicture,
          fail: () => setError(PREVIEW_FAILED_MESSAGE),
        });
        setStatus('ready');
        if (startPreview.current) scheduler.current.request(valuesRef.current);
      },
      () => { if (!closed.current) setStatus('failed'); },
    );
    return () => {
      closed.current = true;
      scheduler.current?.cancel();
      scheduler.current = null;
      session.current = null;
      if (shown.current !== null) settings.current.revokePreview(shown.current);
      shown.current = null;
      if (opened !== null) {
        const toClose = opened;
        void enqueue(async () => toClose.close()); // after a render that is still running
      }
    };
  }, [openSession, enqueue]);

  const change = useCallback((next: V) => {
    valuesRef.current = next;
    setValues(next);
    scheduler.current?.request(next);
  }, []);
  const setValue = useCallback((id: string, value: number) => change({ ...valuesRef.current, [id]: value }), [change]);
  const reset = useCallback(() => change({ ...defaults }), [change, defaults]);

  const apply = useCallback(
    async (commit: (image: PixelImage) => Promise<boolean>): Promise<boolean> => {
      const current = session.current;
      if (current === null || applyingRef.current) return false;
      applyingRef.current = true;
      scheduler.current?.cancel();
      setError(null);
      setApplying(true);
      try {
        let image: PixelImage;
        try {
          image = await enqueue(() => current.renderFinal(valuesRef.current));
        } catch {
          if (!closed.current) setError(APPLY_FAILED_MESSAGE);
          return false;
        }
        if (closed.current) return false; // Cancel came first: nothing is committed
        let stored = false;
        try {
          stored = await commit(image);
        } catch {
          stored = false;
        }
        if (!stored && !closed.current) setError(COMMIT_FAILED_MESSAGE);
        return stored;
      } finally {
        applyingRef.current = false;
        if (!closed.current) setApplying(false);
      }
    },
    [enqueue],
  );

  return { status, values, setValue, reset, previewUrl, canApply: status === 'ready' && isChanged(values), applying, error, apply };
}
