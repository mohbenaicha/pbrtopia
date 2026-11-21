export type NormalDetail = 1 | 2 | 3 | 4;

export interface DetailLevel {
  level: NormalDetail;
  name: string;
  sentence: string;
}

// normal-map R7, contracts.md: the common part comes first, joined to the level sentence by one blank line. It asks for a HEIGHT map of the upright sheet;
// the app derives the normals from it (R18).
export const NORMAL_COMMON_PROMPT =
  'The picture is a texture sheet: separate pieces of a 3D model laid flat on a black background. Make a greyscale HEIGHT map of it. Pure black is the lowest point, pure white is the highest point, and mid grey (128) is a flat surface at neutral height. Read the relief from the visible features, the way the real surface would stand out or sink in. Colour patterns are paint, not relief: stripes, checkers, stains and colour differences on a flat surface stay flat. Do not paint lighting or shadows. Keep every piece exactly where it is, with the same outline, size and rotation. Fill the empty background with flat mid grey. Output greyscale only, no colour, no text.';

// normal-map R6: each level keeps everything the level below asks for and adds a scale of detail; every level says paint is not relief.
export const DETAIL_LEVELS: readonly [DetailLevel, DetailLevel, DetailLevel, DetailLevel] = [
  {
    level: 1,
    name: 'Broad forms',
    sentence:
      'Broad forms: show only the large shapes of the surface, such as bulges, dents, major panels and big folds. Leave out every fine texture and treat painted or printed patterns as flat.',
  },
  {
    level: 2,
    name: 'Medium',
    sentence:
      'Medium detail: show the large shapes and also the clear feature edges and seams, such as panel lines, trims, stitched seams, medium folds, large cracks and gaps between planks. Leave out fine surface texture, and treat painted or printed patterns as flat.',
  },
  {
    level: 3,
    name: 'Fine',
    sentence:
      'Fine detail: show the large shapes, the feature edges and seams, and also the fine surface texture the picture implies, such as weave, grain, stitching, rivets, scratches and small damage. Painted or printed patterns stay flat.',
  },
  {
    level: 4,
    name: 'Maximum',
    sentence:
      'Maximum detail: show every visible variation in relief, from the large shapes down to micro detail such as fibres, noise-level grain, hairline cracks and pitting, as strongly as the picture supports. Painted or printed patterns still stay flat.',
  },
];

export function buildNormalPrompt(level: NormalDetail): string {
  return `${NORMAL_COMMON_PROMPT}\n\n${(DETAIL_LEVELS.find((d) => d.level === level) ?? DETAIL_LEVELS[1]).sentence}`;
}

// normal-map R11: the three progress steps of a normal-map run, in order.
export const NORMAL_PROGRESS_LABELS = { prepare: 'Preparing the islands', generate: 'Generating the height map', derive: 'Building the normal map' } as const;
