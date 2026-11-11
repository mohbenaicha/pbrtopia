// Imageops R7, R8: render targets cached by (format, width, height). A leased target is live and never handed out twice; releasing it returns it to the cache.

export type RtFormat = 'rgba8' | 'r8' | 'rgba16f';

export interface RtLease<T> {
  readonly target: T;
  release(): void;
}

export interface RtPool<T> {
  acquire(format: RtFormat, width: number, height: number): RtLease<T>;
  /** Targets currently leased out. */
  liveCount(): number;
  /** Frees every target, leased or cached; the pool takes no more leases (project close). */
  dispose(): void;
}

export function createRtPool<T extends { dispose(): void }>(create: (format: RtFormat, width: number, height: number) => T): RtPool<T> {
  const cached = new Map<string, T[]>();
  const live = new Set<T>();
  const everMade = new Set<T>();
  let closed = false;

  return {
    acquire(format, width, height) {
      if (closed) throw new Error('The render-target pool is closed.');
      const key = `${format}:${width}x${height}`;
      const target = cached.get(key)?.pop() ?? create(format, width, height);
      everMade.add(target);
      live.add(target);
      let released = false;
      return {
        target,
        release() {
          if (released || closed) return;
          released = true;
          live.delete(target);
          const list = cached.get(key) ?? [];
          list.push(target);
          cached.set(key, list);
        },
      };
    },
    liveCount: () => live.size,
    dispose() {
      closed = true;
      for (const target of everMade) target.dispose();
      everMade.clear();
      cached.clear();
      live.clear();
    },
  };
}
