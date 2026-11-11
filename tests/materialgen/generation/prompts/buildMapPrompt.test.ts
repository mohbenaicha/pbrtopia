import { describe, expect, it } from 'vitest';
import type { CanvasRule } from '@shared/generation/catalog/canvasRules';
import { chooseLayout, type PackedLayout } from '@mat/generation/layout/chooseLayout';
import { buildDecompositionImagePrompt, buildMapPrompt, TILEABLE_SENTENCE } from '@mat/generation/prompts/buildMapPrompt';
import type { PlanMap } from '@mat/generation/plan/planTypes';

const listRule = (canvases: Array<[number, number]>): CanvasRule => ({ kind: 'list', byResolution: { '1K': canvases.map(([width, height]) => ({ width, height })) } });
const layoutOf = (count: number, canvases: Array<[number, number]>): PackedLayout => {
  const choice = chooseLayout(listRule(canvases), '1K', count);
  if (!choice.ok) throw new Error(choice.reason);
  return choice.layout;
};
const one = layoutOf(1, [[1024, 1024]]);
const prompt = (maps: PlanMap[], layout: PackedLayout, extra: { userText?: string; colorMode?: 'albedo' | 'diffuse'; follower?: boolean } = {}) =>
  buildMapPrompt({ maps, layout, userText: extra.userText ?? '', colorMode: extra.colorMode ?? 'albedo', follower: extra.follower ?? false });

describe('materialgen/generation R31 R38 order of the parts', () => {
  it('R31 the recipe comes first, then the user text verbatim as "Material: ...", then the tileability sentence', () => {
    const text = prompt(['albedo'], one, { userText: 'Weathered red brick wall, lime mortar' });
    const recipeAt = text.indexOf('Generate the albedo map');
    const materialAt = text.indexOf('Material: Weathered red brick wall, lime mortar');
    const tileAt = text.indexOf(TILEABLE_SENTENCE);
    expect(recipeAt).toBe(0);
    expect(materialAt).toBeGreaterThan(recipeAt);
    expect(tileAt).toBeGreaterThan(materialAt);
    expect(text.endsWith(TILEABLE_SENTENCE)).toBe(true);
  });

  it('R31 an empty or all-space user text leaves the Material line out', () => {
    expect(prompt(['albedo'], one, { userText: '' })).not.toContain('Material:');
    expect(prompt(['albedo'], one, { userText: '  \n ' })).not.toContain('Material:');
  });

  it('R38 every prompt has the tileability sentence; a packed one adds that each map is seamless on its own edges', () => {
    expect(prompt(['normal'], one)).toContain(TILEABLE_SENTENCE);
    expect(prompt(['normal'], one)).not.toContain('on its own edges');
    const packed = prompt(['albedo', 'normal'], layoutOf(2, [[1024, 512]]));
    expect(packed).toContain(TILEABLE_SENTENCE);
    expect(packed).toContain('Each map is seamless on its own edges.');
  });

  it('R38 no prompt asks for roughness, metal or an AO map', () => {
    for (const maps of [['albedo'], ['normal'], ['height'], ['albedo', 'normal', 'height']] as PlanMap[][]) {
      const text = prompt(maps, maps.length === 1 ? one : layoutOf(maps.length, [[1024, 1024], [1536, 512]])).toLowerCase();
      expect(text).not.toContain('roughness');
      expect(text).not.toContain('metal');
      expect(text).not.toContain('occlusion map');
    }
  });
});

describe('materialgen/generation R32 R33 R34 R36 what each map asks for', () => {
  it('R32 Albedo is flat colour with no lighting, shadows, occlusion or highlights', () => {
    const text = prompt(['albedo'], one);
    expect(text).toContain('top-down view');
    expect(text).toContain('NO lighting, NO shadows, NO ambient occlusion, NO highlights or reflections');
  });

  it('R32 Diffuse changes only those words: baked lighting and shadows are allowed', () => {
    const albedo = prompt(['albedo'], one);
    const diffuse = prompt(['albedo'], one, { colorMode: 'diffuse' });
    expect(diffuse).toContain('subtle baked lighting and shadows allowed for a realistic look');
    expect(diffuse).not.toContain('NO lighting');
    expect(diffuse.split('\n\n').slice(1)).toEqual(albedo.split('\n\n').slice(1)); // the other parts are the same
  });

  it('R33 Height is greyscale only, white high, black low, mid grey flat, no colour and no lighting', () => {
    const text = prompt(['height'], one);
    expect(text).toContain('white is high, black is low, mid grey is the flat level');
    expect(text).toContain('greyscale only, no colour, no lighting');
  });

  it('R34 Normal is tangent-space, mostly blue, flat areas RGB 128, 128, 255, relief only, and names the OpenGL +Y up convention', () => {
    const text = prompt(['normal'], one);
    expect(text).toContain('tangent-space normal map');
    expect(text).toContain('OpenGL');
    expect(text).toContain('+Y up');
    expect(text).toContain('RGB 128, 128, 255');
    expect(text).toContain('surface relief only, no lighting, no shadows');
  });

  it('R36 a follower says the attached image is the albedo of the same material, and Normal and Height follow its features', () => {
    const normal = prompt(['normal'], one, { follower: true });
    expect(normal).toContain('attached image is the albedo of the same material');
    expect(normal).toContain('relief of the normal map follows the features of the albedo');
    const height = prompt(['height'], one, { follower: true });
    expect(height).toContain('high and low areas of the height map follow the features of the albedo');
    expect(prompt(['albedo'], one)).not.toContain('attached image');
  });
});

describe('materialgen/generation R35 packed images', () => {
  it('R35 two maps: the composite structure, panel wording left to right, no labels', () => {
    const text = prompt(['albedo', 'normal'], layoutOf(2, [[1024, 512]]));
    expect(text).toContain('Generate an image comprised of 2 maps of a top-down view of the material, arranged in a grid of 2 columns and 1 row, in reading order from left to right: first albedo map, second normal map.');
    expect(text).toContain('Maps have no separators or labels, just the seamless texture maps equal in size.');
    expect(text).toContain('The first map is the albedo map:');
    expect(text).toContain('The second map is the normal map:');
  });

  it('R35 a 1x2 grid reads top to bottom', () => {
    expect(prompt(['albedo', 'height'], layoutOf(2, [[512, 1024]]))).toContain('1 column and 2 rows, in reading order from top to bottom');
  });

  it('R35 2x2 uses quadrant wording and says the remaining space is plain mid grey', () => {
    const text = prompt(['albedo', 'normal', 'height'], layoutOf(3, [[1024, 1024]]));
    expect(text).toContain('one map per quadrant: top-left albedo map, top-right normal map, bottom-left height map');
    expect(text).toContain('The remaining space is plain mid grey.');
  });

  it('R35 only an empty cell is mentioned as grey space: a pack with no empty cell never is, whatever the canvas', () => {
    expect(prompt(['albedo', 'normal', 'height'], layoutOf(3, [[900, 300]]))).not.toContain('plain mid grey');
    expect(prompt(['albedo', 'normal', 'height'], layoutOf(3, [[1000, 300]]))).not.toContain('plain mid grey');
  });

  it('R35 R36 a packed follower holding Normal and Height carries both follow sentences once', () => {
    const text = prompt(['normal', 'height'], layoutOf(2, [[1024, 512]]), { follower: true });
    expect(text.match(/attached image is the albedo/g)).toHaveLength(1);
    expect(text).toContain('relief of the normal map');
    expect(text).toContain('height map follow');
  });

  it('R35 Diffuse mode names the colour map Diffuse inside a pack', () => {
    expect(prompt(['albedo', 'normal'], layoutOf(2, [[1024, 512]]), { colorMode: 'diffuse' })).toContain('first diffuse map, second normal map');
  });
});

describe('materialgen/generation R37 the decomposition prompt', () => {
  it('R37 is the masks prompt unchanged, then the tileability sentence, and holds no user text', () => {
    const masksPrompt = 'Repaint the texture: gold surface, top left: paint it #FF0000 red.';
    expect(buildDecompositionImagePrompt(masksPrompt)).toBe(`${masksPrompt}\n\n${TILEABLE_SENTENCE}`);
  });
});
