export interface ContextLossHandlers {
  onLost: () => void;
  onRestored: () => void;
}

// Forwards the canvas's WebGL context events. The lost event's default is prevented, otherwise the browser never restores the context. Returns a function that stops listening.
export function watchContextLoss(canvas: HTMLCanvasElement, { onLost, onRestored }: ContextLossHandlers): () => void {
  const handleLost = (event: Event): void => {
    event.preventDefault();
    onLost();
  };
  const handleRestored = (): void => onRestored();
  canvas.addEventListener('webglcontextlost', handleLost);
  canvas.addEventListener('webglcontextrestored', handleRestored);
  return () => {
    canvas.removeEventListener('webglcontextlost', handleLost);
    canvas.removeEventListener('webglcontextrestored', handleRestored);
  };
}
