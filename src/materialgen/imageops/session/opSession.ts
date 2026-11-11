import type { PixelImage } from '../gpu/pixelFormats';

// Imageops R7, R18, R19: what every single-map op session (filter, AO) offers the dialog that drives it.
export interface OpSession<Values> {
  readonly size: number; // S
  readonly previewSize: number; // P
  /** The op at size P into the session's temporary target. One render at a time (the preview scheduler guarantees it). */
  renderPreview(values: Values): Promise<PixelImage>;
  /** The op at size S from the given values, never from the preview image. */
  renderFinal(values: Values): Promise<PixelImage>;
  /** Gives every pooled target back. */
  close(): void;
}
