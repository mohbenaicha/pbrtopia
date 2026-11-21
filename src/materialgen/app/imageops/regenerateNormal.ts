import type { EditValues, OpSession, PixelImage } from '@mat/imageops';
import type { ImageEdit } from '@mat/maps';

export interface RegenerateNormalPorts {
  /** The decoded working copy of the height map, or null when its file is missing. */
  readPixels(key: string): Promise<PixelImage | null>;
  openNormal(image: PixelImage): Promise<OpSession<EditValues>>;
  applyEdits(edits: readonly ImageEdit[], label: string, grouped: boolean): Promise<boolean>;
}

export interface RegenerateNormalRequest {
  heightKey: string; // the height map's working key: the new normal map is derived from it
  heightLabel: string; // what the person calls the height map, for messages
  values: EditValues;
  ports: RegenerateNormalPorts;
}

export type RegenerateNormalResult = { ok: true } | { ok: false; message?: string };

const COMPUTE_FAILED = 'Could not regenerate the normal map. Nothing changed.';

/** Normal-from-height R8, R10: computes the normal map at S from the remembered parameters and commits one single-map edit. A failure changes nothing. */
export async function regenerateNormal({ heightKey, heightLabel, values, ports }: RegenerateNormalRequest): Promise<RegenerateNormalResult> {
  const pixels = await ports.readPixels(heightKey);
  if (pixels === null) return { ok: false, message: `${heightLabel}: the file cannot be read.` };
  let image: PixelImage;
  try {
    const session = await ports.openNormal(pixels);
    try {
      image = await session.renderFinal(values);
    } finally {
      session.close();
    }
  } catch {
    return { ok: false, message: COMPUTE_FAILED };
  }
  const committed = await ports.applyEdits([{ kind: 'normal', image, derivedFrom: { kind: 'height', key: heightKey } }], 'Regenerate normal map', false);
  return committed ? { ok: true } : { ok: false }; // the controller has already said why
}
