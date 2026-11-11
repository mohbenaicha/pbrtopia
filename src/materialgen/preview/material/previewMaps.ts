import type { PixelImage } from '@mat/workerapi';

/** The working copies the preview draws, decoded. A key that is absent is a map the material does not have (preview R45, R46). */
export interface PreviewMaps {
  albedo?: PixelImage;
  normal?: PixelImage;
  height?: PixelImage;
  ao?: PixelImage;
  rough?: PixelImage;
  metal?: PixelImage;
  labels?: PixelImage; // the mask labels (R8); drawn only by the mask overlay (R18)
}

export type PreviewMapKind = keyof PreviewMaps;
