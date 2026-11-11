import { useEffect, useRef, useState } from 'react';
import { resampleToSquare } from '../pixels/resampleToSquare';
import type { PixelImage } from '../png/pngCodec';
import { readMapPixels } from '../readMapPixels';

export const THUMBNAIL_SIDE = 256; // maps R50: at most this on the longer side, never persisted

export type DrawThumbnail = (canvas: HTMLCanvasElement, pixels: PixelImage) => void;

/** Paints 8-bit grey, RGB or RGBA pixels on a canvas. */
export const drawPixelsOnCanvas: DrawThumbnail = (canvas, pixels) => {
  const context = canvas.getContext('2d');
  if (!context) return;
  canvas.width = pixels.width;
  canvas.height = pixels.height;
  const rgba = new Uint8ClampedArray(pixels.width * pixels.height * 4);
  for (let i = 0; i < pixels.width * pixels.height; i += 1) {
    const at = i * pixels.channels;
    rgba[i * 4] = pixels.data[at]!;
    rgba[i * 4 + 1] = pixels.data[pixels.channels === 1 ? at : at + 1]!;
    rgba[i * 4 + 2] = pixels.data[pixels.channels === 1 ? at : at + 2]!;
    rgba[i * 4 + 3] = pixels.channels === 4 ? pixels.data[at + 3]! : 255;
  }
  context.putImageData(new ImageData(rgba, pixels.width, pixels.height), 0, 0);
};

interface MapThumbnailProps {
  /** The map's name, for the accessible label. */
  label: string;
  /** The working key; the picture is made again when it changes (R50). */
  blobKey: string;
  readBlob(key: string): Promise<Blob | null>;
  draw?: DrawThumbnail;
}

/** Maps R44, R50, R30: a small canvas of the working map, made from its file; a file that cannot be read shows "Missing file". */
export function MapThumbnail({ label, blobKey, readBlob, draw = drawPixelsOnCanvas }: MapThumbnailProps): React.JSX.Element {
  const canvas = useRef<HTMLCanvasElement>(null);
  const [missing, setMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setMissing(false);
    void (async () => {
      const pixels = await readMapPixels(await readBlob(blobKey).catch(() => null));
      if (cancelled) return;
      if (pixels === null) return setMissing(true);
      const side = Math.min(THUMBNAIL_SIDE, Math.max(pixels.width, pixels.height));
      if (canvas.current) draw(canvas.current, side < pixels.width || side < pixels.height ? resampleToSquare(pixels, side) : pixels);
    })();
    return () => {
      cancelled = true;
    };
  }, [blobKey, readBlob, draw]);

  return missing ? (
    <span className="map-card__missing" role="status">Missing file</span>
  ) : (
    <canvas ref={canvas} className="map-card__thumbnail" role="img" aria-label={`${label} thumbnail`} />
  );
}
