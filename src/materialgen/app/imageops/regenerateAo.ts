import type { AoSource, EditValues, OpSession, PixelImage } from '@mat/imageops';
import type { ImageEdit } from '@mat/maps';

export interface RegenerateAoPorts {
  /** The decoded working copy of the source map, or null when its file is missing. */
  readPixels(key: string): Promise<PixelImage | null>;
  openAo(image: PixelImage, source: AoSource): Promise<OpSession<EditValues>>;
  applyEdits(edits: readonly ImageEdit[], label: string, grouped: boolean): Promise<boolean>;
}

export interface RegenerateAoRequest {
  source: AoSource;
  sourceKey: string; // the source map's working key: the new AO is derived from it
  sourceLabel: string; // what the person calls the source map, for messages
  values: EditValues;
  ports: RegenerateAoPorts;
}

export type RegenerateAoResult = { ok: true } | { ok: false; message?: string };

const GRAPHICS_FAILED = 'Could not regenerate (graphics error). Nothing changed.';

/** Imageops R12, R44: renders AO at S from the remembered parameters and commits one single-map edit. A failure changes nothing. */
export async function regenerateAo({ source, sourceKey, sourceLabel, values, ports }: RegenerateAoRequest): Promise<RegenerateAoResult> {
  const pixels = await ports.readPixels(sourceKey);
  if (pixels === null) return { ok: false, message: `${sourceLabel}: the file cannot be read.` };
  let image: PixelImage;
  try {
    const session = await ports.openAo(pixels, source);
    try {
      image = await session.renderFinal(values);
    } finally {
      session.close();
    }
  } catch {
    return { ok: false, message: GRAPHICS_FAILED };
  }
  const committed = await ports.applyEdits([{ kind: 'ao', image, derivedFrom: { kind: source, key: sourceKey } }], 'Regenerate AO', false);
  return committed ? { ok: true } : { ok: false }; // the controller has already said why
}
