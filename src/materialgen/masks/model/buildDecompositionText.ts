import type { Component } from '../describe/parseComponents';
import { paletteFor } from '../palette/palette';

const RULES = [
  'Repaint this texture as a flat colour map: one flat colour per feature, using only these colours, with no gradients, no outlines, no shading and no text.',
  'Keep the exact geometry and the same framing as the reference image.',
].join(' ');

/** Masks R12: the whole decomposition text. Each component is listed with its palette colour; it holds no user text. */
export function buildDecompositionText(components: ReadonlyArray<Component>): string {
  const palette = paletteFor(components.length);
  const lines = components.map((component, at) => {
    const colour = palette[at]!;
    const detail = component.description === '' ? component.name : `${component.name} (${component.description})`;
    const where = component.location === '' ? '' : `, ${component.location}`;
    return `- ${detail}${where}: paint it ${colour.hex} ${colour.name}`;
  });
  return `${RULES}\n\n${lines.join('\n')}`;
}
