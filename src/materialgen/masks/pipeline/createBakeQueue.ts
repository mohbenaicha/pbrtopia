interface BakeQueuePorts<T> {
  /** The value as it is stored now: what the next batch of changes starts from. */
  read(): T;
  /** Bakes and stores the value; false when it could not (masks R70). */
  run(value: T): Promise<boolean>;
}

export interface BakeQueue<T> {
  /** Adds a change; the answer is whether the bake that carried it was stored. */
  submit(update: (value: T) => T): Promise<boolean>;
  isBusy(): boolean;
}

interface Waiting<T> {
  update: (value: T) => T;
  settle(stored: boolean): void;
}

/**
 * Masks R58, R70: at most one bake runs at a time; changes that arrive meanwhile are merged, in the order they came, into one further bake from
 * the latest stored value. A bake that fails or throws answers false to each change it carried and leaves the queue ready for the next one.
 */
export function createBakeQueue<T>({ read, run }: BakeQueuePorts<T>): BakeQueue<T> {
  let waiting: Waiting<T>[] = [];
  let running = false;

  const drain = async (): Promise<void> => {
    running = true;
    while (waiting.length > 0) {
      const batch = waiting;
      waiting = [];
      let stored = false;
      try {
        stored = await run(batch.reduce((value, change) => change.update(value), read()));
      } catch {
        stored = false;
      }
      for (const change of batch) change.settle(stored);
    }
    running = false;
  };

  return {
    submit: (update) =>
      new Promise<boolean>((settle) => {
        waiting.push({ update, settle });
        if (!running) void drain();
      }),
    isBusy: () => running || waiting.length > 0,
  };
}
