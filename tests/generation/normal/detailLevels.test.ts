import { describe, expect, it } from 'vitest';
import { buildNormalPrompt, DETAIL_LEVELS, NORMAL_COMMON_PROMPT, NORMAL_PROGRESS_LABELS } from '../../../src/generation/normal/detailLevels';

describe('detail levels', () => {
  it('normal-map R5 has four named steps in order', () => {
    expect(DETAIL_LEVELS.map((d) => d.name)).toEqual(['Broad forms', 'Medium', 'Fine', 'Maximum']);
    expect(DETAIL_LEVELS.map((d) => d.level)).toEqual([1, 2, 3, 4]);
  });

  it('normal-map R6 level 1 says to ignore fine texture and level 4 reaches micro detail', () => {
    expect(DETAIL_LEVELS[0].sentence).toMatch(/Leave out every fine texture/);
    expect(DETAIL_LEVELS[0].sentence).toMatch(/painted or printed patterns as flat/);
    expect(DETAIL_LEVELS[3].sentence).toMatch(/micro detail/);
  });

  it('normal-map R6 each level keeps what the level below asks for', () => {
    const scope = [['bulges', 'dents', 'major panels', 'big folds'], ['panel lines', 'trims', 'stitched seams', 'medium folds'], ['weave', 'grain', 'stitching', 'rivets', 'scratches'], ['fibres', 'hairline cracks', 'pitting']];
    // level 2 keeps the broad forms by naming "large shapes"; levels 3 and 4 name the shapes and edges they keep.
    expect(DETAIL_LEVELS[1].sentence).toMatch(/large shapes/);
    expect(DETAIL_LEVELS[2].sentence).toMatch(/large shapes/);
    expect(DETAIL_LEVELS[2].sentence).toMatch(/feature edges and seams/);
    expect(DETAIL_LEVELS[3].sentence).toMatch(/large shapes/);
    for (let i = 1; i < 4; i += 1) for (const word of scope[i] ?? []) expect(DETAIL_LEVELS[i]?.sentence).toContain(word);
    for (const word of scope[0] ?? []) expect(DETAIL_LEVELS[0].sentence).toContain(word);
  });

  it('normal-map R7 the prompt is the common part, one blank line, then the chosen sentence', () => {
    for (const d of DETAIL_LEVELS) expect(buildNormalPrompt(d.level)).toBe(`${NORMAL_COMMON_PROMPT}\n\n${d.sentence}`);
  });

  it('normal-map R7 the common part is the height-map prompt of contracts.md, byte for byte', () => {
    expect(NORMAL_COMMON_PROMPT).toBe(
      'The picture is a texture sheet: separate pieces of a 3D model laid flat on a black background. Make a greyscale HEIGHT map of it. Pure black is the lowest point, pure white is the highest point, and mid grey (128) is a flat surface at neutral height. Read the relief from the visible features, the way the real surface would stand out or sink in. Colour patterns are paint, not relief: stripes, checkers, stains and colour differences on a flat surface stay flat. Do not paint lighting or shadows. Keep every piece exactly where it is, with the same outline, size and rotation. Fill the empty background with flat mid grey. Output greyscale only, no colour, no text.',
    );
  });

  it('normal-map R6 every level says painted or printed pattern is not relief', () => {
    for (const d of DETAIL_LEVELS) expect(d.sentence).toMatch(/painted or printed patterns?\b/i);
  });

  it('normal-map R6 the four sentences are those of contracts.md, byte for byte', () => {
    expect(DETAIL_LEVELS.map((d) => d.sentence)).toEqual([
      'Broad forms: show only the large shapes of the surface, such as bulges, dents, major panels and big folds. Leave out every fine texture and treat painted or printed patterns as flat.',
      'Medium detail: show the large shapes and also the clear feature edges and seams, such as panel lines, trims, stitched seams, medium folds, large cracks and gaps between planks. Leave out fine surface texture, and treat painted or printed patterns as flat.',
      'Fine detail: show the large shapes, the feature edges and seams, and also the fine surface texture the picture implies, such as weave, grain, stitching, rivets, scratches and small damage. Painted or printed patterns stay flat.',
      'Maximum detail: show every visible variation in relief, from the large shapes down to micro detail such as fibres, noise-level grain, hairline cracks and pitting, as strongly as the picture supports. Painted or printed patterns still stay flat.',
    ]);
  });

  it('normal-map R11 the three progress labels are in the order of the run', () => {
    expect(NORMAL_PROGRESS_LABELS).toEqual({ prepare: 'Preparing the islands', generate: 'Generating the height map', derive: 'Building the normal map' });
  });
});
