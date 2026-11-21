import type { Component } from '../describe/parseComponents';
import { paletteFor } from '../palette/palette';

/** Material gen's first sentence of the decomposition text (masks R12); material-masks-core R7 lets a caller give its own. */
export const DEFAULT_FRAMING = 'Repaint this texture as a flat colour map: one flat colour per feature, using only these colours, with no gradients, no outlines, no shading and no text.';
const KEEP_GEOMETRY = 'Keep the exact geometry and the same framing as the reference image.';

/**
 * Masks R12, material-masks-core R7: the whole decomposition text. `framing` is the first sentence; the second sentence and the colour lines are
 * fixed. Each component is listed with its palette colour; it holds no user text.
 */
export function buildDecompositionText(components: ReadonlyArray<Component>, framing: string = DEFAULT_FRAMING): string {
  const rules = `${framing} ${KEEP_GEOMETRY}`;
  const palette = paletteFor(components.length);
  const lines = components.map((component, at) => {
    const colour = palette[at]!;
    const detail = component.description === '' ? component.name : `${component.name} (${component.description})`;
    const where = component.location === '' ? '' : `, ${component.location}`;
    return `- ${detail}${where}: paint it ${colour.hex} ${colour.name}`;
  });
  return `${rules}\n\n${lines.join('\n')}`;
}
