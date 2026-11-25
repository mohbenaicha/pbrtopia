import { describe, expect, it } from 'vitest';
import { IMAGE_CLOSING } from '../../../src/generation/prompts/framePrompt';
import { buildMaskDecomposition, buildMaskDescribeText, MASK_COMPONENT_LIMITS, MASK_DESCRIBE_INSTRUCTION } from '../../../src/generation/masks/maskPrompts';

const components = [
  { name: 'Brushed steel', description: 'grey metal, scratched', location: 'front: chest; back: shoulder blades' },
  { name: 'Canvas', description: '', location: '' },
];

describe('mask prompts (mask-generation R7, R9, R8)', () => {
  it('mask-generation R7 the describe text is the contract text, line by line, and nothing follows it without a prompt', () => {
    expect(MASK_DESCRIBE_INSTRUCTION.split('\n')).toEqual([
      'You describe the materials of a 3D object shown in the attached image.',
      'The image holds six views of one single object on one sheet: front, right, back, left, top and bottom, each named in the band above it.',
      'Reply with JSON only: an array of 2 to 10 components, one for each visibly different material of the whole object. Count each material once, however many views show it.',
      'Each component is an object with three text fields:',
      '"name": a short name of the material,',
      '"description": what it looks like (material, colour, wear),',
      '"location": where it lies on the object, said for every view where it appears, for example "front: chest and sleeves; back: shoulder blades; top: none".',
      'Return no other field and no text outside the JSON.',
    ]);
    expect(buildMaskDescribeText('')).toBe(MASK_DESCRIBE_INSTRUCTION);
    expect(buildMaskDescribeText('   ')).toBe(MASK_DESCRIBE_INSTRUCTION);
  });

  it('mask-generation R7 the user\'s prompt follows after a blank line', () => {
    expect(buildMaskDescribeText(' the helmet is gold ')).toBe(`${MASK_DESCRIBE_INSTRUCTION}\n\nthe helmet is gold`);
  });

  it('mask-generation R7 a mask run asks for 2 to 10 components', () => {
    expect(MASK_COMPONENT_LIMITS).toEqual({ min: 2, max: 10 });
  });

  it('mask-generation R9 the decomposition is the projection framing, one line per component in palette order, then the image closing sentence', () => {
    const text = buildMaskDecomposition(components);
    expect(text.startsWith('Repaint every perspective in this image as a flat colour map: one flat colour per material, using only these colours, with no gradients, no outlines, no shading and no text. Keep the exact silhouette, position and size of every perspective, and keep the grey background exactly as it is.')).toBe(true);
    const lines = text.split('\n');
    expect(lines).toContain('- Brushed steel (grey metal, scratched), front: chest; back: shoulder blades: paint it #FF0000 red');
    expect(lines.findIndex((line) => line.includes('Brushed steel'))).toBeLessThan(lines.findIndex((line) => line.startsWith('- Canvas')));
    expect(lines.find((line) => line.startsWith('- Canvas'))).toMatch(/^- Canvas: paint it #00FF00 green$/i);
    expect(text.endsWith(`\n\n${IMAGE_CLOSING}`)).toBe(true);
  });

  it('mask-generation R9 the decomposition holds no user text', () => {
    expect(buildMaskDecomposition(components)).not.toContain('the helmet is gold');
  });
});

describe('mask prompts: existing materials (mask-generation R24)', () => {
  const TAIL = 'Some of these may be on parts that are hidden and not shown in the image. If a part you can see is made of one of these materials, return it with exactly that name. Add new components only for parts not covered. Do not return listed materials you cannot see.';
  const rows = [
    { id: 'a', name: 'Brushed steel', description: 'grey metal, scratched', material: 'Steel' },
    { id: 'b', name: 'Canvas', description: '', material: 'Cotton' },
  ];

  it('mask-generation R24 the block lists each row in order with its description and base material, then the closing sentences', () => {
    const text = buildMaskDescribeText('', rows);
    expect(text).toBe(`${MASK_DESCRIBE_INSTRUCTION}\n\nMaterials already described on this object:\n- "Brushed steel" (grey metal, scratched), material Steel\n- "Canvas", material Cotton\n${TAIL}`);
  });

  it('mask-generation R24 the block sits before the user prompt, which follows after a blank line', () => {
    const text = buildMaskDescribeText('  a worn chest ', rows);
    expect(text.endsWith(`${TAIL}\n\na worn chest`)).toBe(true);
  });

  it('mask-generation R24 with no rows, or no argument, the text is R7 byte for byte', () => {
    expect(buildMaskDescribeText('a worn chest', [])).toBe(buildMaskDescribeText('a worn chest'));
    expect(buildMaskDescribeText('', undefined)).toBe(MASK_DESCRIBE_INSTRUCTION);
  });

  it('mask-generation R24 thirty-two rows give thirty-two lines', () => {
    const many = Array.from({ length: 32 }, (_, k) => ({ id: `i${k}`, name: `M${k}`, description: '', material: 'Generic' }));
    expect(buildMaskDescribeText('', many).split('\n').filter((line) => line.startsWith('- "'))).toHaveLength(32);
  });
});
