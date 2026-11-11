// Imageops R18: filter previews are rendered 75 ms after the last change, one at a time, and a result older than the newest request is never shown.

export const PREVIEW_DELAY_MS = 75;

interface PreviewSchedulerOptions<Values, Result> {
  render(values: Values): Promise<Result>;
  show(result: Result): void;
  fail?(error: unknown): void;
  delayMs?: number;
}

export interface PreviewScheduler<Values> {
  request(values: Values): void;
  /** Drops the waiting request and any render still running (its result is ignored). */
  cancel(): void;
}

export function createPreviewScheduler<Values, Result>({ render, show, fail, delayMs = PREVIEW_DELAY_MS }: PreviewSchedulerOptions<Values, Result>): PreviewScheduler<Values> {
  let newest = 0; // the counter each request carries: a result is shown only while it is still the newest
  let timer: ReturnType<typeof setTimeout> | null = null;
  let running = false;
  let waiting: { values: Values; id: number } | null = null;

  const startWaiting = (): void => {
    if (running || waiting === null) return;
    const { values, id } = waiting;
    waiting = null;
    running = true; // the session owns one temporary target, so renders never overlap (R7)
    render(values)
      .then((result) => { if (id === newest) show(result); })
      .catch((error: unknown) => { if (id === newest) fail?.(error); })
      .finally(() => {
        running = false;
        startWaiting();
      });
  };

  return {
    request(values) {
      newest += 1;
      const id = newest;
      if (timer !== null) clearTimeout(timer);
      timer = setTimeout(() => {
        timer = null;
        waiting = { values, id };
        startWaiting();
      }, delayMs);
    },
    cancel() {
      newest += 1;
      if (timer !== null) clearTimeout(timer);
      timer = null;
      waiting = null;
    },
  };
}
