/** PNG of a canvas that already holds the picture (no second canvas, no whole-image copy; architecture D11). The browser encodes off the main thread. */
export function encodeCanvasPng(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob === null ? reject(new Error('PNG encoding failed')) : resolve(blob)), 'image/png');
  });
}
