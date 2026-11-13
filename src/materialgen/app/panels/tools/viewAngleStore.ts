/** Imageops R72, R74: the one number that goes from the viewport to the plane picker, the turn of the picture in the view in degrees clockwise. */
export interface ViewAngleStore {
  get(): number;
  set(degrees: number): void; // a new angle is announced once; the same angle is not announced at all
  subscribe(listener: () => void): () => void;
  watch(): () => void; // a picker is on screen and wants the angle; the returned function says it is gone
  isWatched(): boolean; // the viewport reads the angle only while this is true (R74)
  subscribeWatched(listener: () => void): () => void; // heard when the answer of isWatched changes
}

export function createViewAngleStore(): ViewAngleStore {
  let angle = 0;
  let watchers = 0;
  const listeners = new Set<() => void>();
  const watchedListeners = new Set<() => void>();
  return {
    get: () => angle,
    set(degrees) {
      if (degrees === angle) return;
      angle = degrees;
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
    watch() {
      let released = false;
      watchers += 1;
      if (watchers === 1) watchedListeners.forEach((listener) => listener());
      return () => {
        if (released) return;
        released = true;
        watchers -= 1;
        if (watchers === 0) watchedListeners.forEach((listener) => listener());
      };
    },
    isWatched: () => watchers > 0,
    subscribeWatched(listener) {
      watchedListeners.add(listener);
      return () => void watchedListeners.delete(listener);
    },
  };
}
