export interface ViewportEventPayloads {
  'context-lost': undefined;
  'context-restored': undefined;
  'camera-change': undefined;
  'projection-changed': 'perspective' | 'orthographic';
}

export type ViewportEventName = keyof ViewportEventPayloads;

type Listener<E extends ViewportEventName> = (payload: ViewportEventPayloads[E]) => void;

export interface ViewportEvents {
  on<E extends ViewportEventName>(event: E, listener: Listener<E>): () => void;
  emit<E extends ViewportEventName>(event: E, ...payload: ViewportEventPayloads[E] extends undefined ? [] : [ViewportEventPayloads[E]]): void;
  clear(): void;
}

export function createViewportEvents(): ViewportEvents {
  const listeners = new Map<ViewportEventName, Set<Listener<ViewportEventName>>>();
  return {
    on(event, listener) {
      const set = listeners.get(event) ?? new Set();
      set.add(listener as Listener<ViewportEventName>);
      listeners.set(event, set);
      return () => set.delete(listener as Listener<ViewportEventName>);
    },
    emit(event, ...payload) {
      // A copy, so a listener may unsubscribe while the event is being delivered.
      [...(listeners.get(event) ?? [])].forEach((listener) => listener(payload[0] as never));
    },
    clear() {
      listeners.clear();
    },
  };
}
