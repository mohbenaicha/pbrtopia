export interface FrameClock {
  requestAnimationFrame(callback: () => void): number;
  cancelAnimationFrame(handle: number): void;
}

interface RenderScheduler {
  invalidate(): void; // ask for a draw on the next animation frame
  drawNow(): void; // draw in this step, taking over a waiting frame: for a resize, which clears the canvas and must not be painted empty
  pause(): void; // draw nothing until resume (context lost)
  resume(): void; // draw once now, then only on invalidate
  dispose(): void;
}

// Draws only when asked: any number of invalidate calls before a frame give one draw, and an idle viewport costs no frames.
export function createRenderScheduler(draw: () => void, clock: FrameClock = window): RenderScheduler {
  let handle: number | null = null;
  let paused = false;
  let disposed = false;

  const schedule = (): void => {
    if (handle !== null || paused || disposed) return;
    handle = clock.requestAnimationFrame(() => {
      handle = null;
      draw();
    });
  };

  const cancel = (): void => {
    if (handle !== null) clock.cancelAnimationFrame(handle);
    handle = null;
  };

  return {
    invalidate: schedule,
    drawNow() {
      if (paused || disposed) return;
      cancel();
      draw();
    },
    pause() {
      paused = true;
      cancel();
    },
    resume() {
      paused = false;
      schedule();
    },
    dispose() {
      disposed = true;
      cancel();
    },
  };
}
