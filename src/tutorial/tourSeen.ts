export interface TourSeenStorage {
  read(): boolean;
  write(): void;
}

/** Whether the tour has ever been started on this device (tutorial R2): one local-storage flag; blocked storage still remembers for the page's life. */
export function createTourSeenStorage(key: string): TourSeenStorage {
  let remembered = false;
  return {
    read() {
      if (remembered) return true;
      try {
        return window.localStorage.getItem(key) !== null;
      } catch {
        return false;
      }
    },
    write() {
      remembered = true;
      try {
        window.localStorage.setItem(key, '1');
      } catch {
        // blocked site data: the flag lasts until the page closes
      }
    },
  };
}
