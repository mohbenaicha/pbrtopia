import { describe, expect, it } from 'vitest';
import { buildDecompositionText, paletteFor } from '@mat/masks';

const components = [
  { name: 'Gold surface', description: 'worn gold paint', location: 'top left' },
  { name: 'Stone', description: 'grey', location: 'bottom' },
  { name: 'Moss', description: 'green', location: 'in the cracks' },
];

describe('materialgen/masks buildDecompositionText', () => {
  it('R12 each component is listed with its name, description, location and palette colour name and hex', () => {
    const text = buildDecompositionText(components);
    const palette = paletteFor(3);
    components.forEach((component, at) => {
      expect(text).toContain(component.name);
      expect(text).toContain(component.description);
      expect(text).toContain(component.location);
      expect(text).toContain(palette[at]!.name);
      expect(text).toContain(palette[at]!.hex);
    });
    expect(text).toContain('Gold surface, top left: paint it #FF0000 red'.replace('Gold surface, top left', 'Gold surface (worn gold paint), top left'));
  });

  it('R12 the text asks for a flat repaint: one colour per feature, only these colours, no gradients, outlines, shading or text, same geometry', () => {
    const text = buildDecompositionText(components).toLowerCase();
    for (const phrase of ['repaint', 'one flat colour', 'only these colours', 'no gradients', 'no outlines', 'no shading', 'no text', 'exact geometry', 'same framing']) {
      expect(text).toContain(phrase);
    }
  });

  it('R12 holds no user text: the same components always give the same text', () => {
    expect(buildDecompositionText(components)).toBe(buildDecompositionText(components.map((component) => ({ ...component }))));
  });
});
