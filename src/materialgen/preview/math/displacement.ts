import type { PreviewValues } from '@mat/storage';

/** What the material's displacement map adds to a vertex for a texel h: `h * scale + bias`, along the vertex normal (three.js `displacementScale`/`displacementBias`). */
export interface DisplacementParams {
  scale: number;
  bias: number;
}

/**
 * Preview R15-R17: a vertex moves by `(h - level) * contrast * heightScale / max(averageTiling, 1)`. With no height map nothing moves (R16).
 */
export function displacementFor(values: PreviewValues, hasHeight: boolean): DisplacementParams {
  if (!hasHeight) return { scale: 0, bias: 0 };
  const averageTiling = (values.tilingX + values.tilingY) / 2;
  const scale = (values.heightContrast * values.heightScale) / Math.max(averageTiling, 1);
  return { scale, bias: -values.heightLevel * scale };
}
