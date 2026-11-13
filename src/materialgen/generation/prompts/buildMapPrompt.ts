import type { PackedLayout } from '../layout/chooseLayout';
import type { PlanMap } from '../plan/planTypes';

export type ColorModeName = 'albedo' | 'diffuse';

export interface MapPromptInput {
  maps: readonly PlanMap[]; // the maps of this image, in reading order
  layout: PackedLayout;
  userText: string;
  colorMode: ColorModeName;
  follower: boolean; // any image other than Image 1: it gets the albedo reference
}

/** R38: the tileability text of every prompt (both directions, and no large features at the edges); a packed image adds a sentence built from its map names. */
export const TILEABLE_SENTENCE =
  'The image must tile seamlessly in both directions: the right edge must continue exactly into the left edge, and the bottom edge exactly into the top edge, as if copies of the image were placed side by side. Keep large features, strong gradients and lighting falloff away from the edges; only fine, evenly spread detail may touch the borders.';

/** R38: tiling is asked of each map on its own; naming the maps keeps it from being read as one map blending into another. */
function describePackedTiling(layout: PackedLayout, names: readonly string[]): string {
  const [first, ...others] = names;
  const area = layout.grid.cols === 2 && layout.grid.rows === 2 ? 'quadrant' : 'area';
  const sameFor = others.length === 0 ? '' : ` The same holds for the ${others.join(' and the ')}.`;
  return `Tiling applies to each map separately. The ${first}'s right edge continues into the ${first}'s own left edge, and its bottom edge into its own top edge.${sameFor} The maps stay completely separate: no colour, relief or detail of one map crosses into the ${area} of another.`;
}

const ORDINALS = ['first', 'second', 'third'] as const;
const TOP_DOWN = 'a top-down view of the material';

/** R32, R33, R34: what each map looks like, as a clause. */
function describeMap(map: PlanMap, colorMode: ColorModeName): string {
  if (map === 'albedo') {
    return colorMode === 'diffuse'
      ? 'the colour of the material with subtle baked lighting and shadows allowed for a realistic look'
      : 'the pure flat colour of the material, NO lighting, NO shadows, NO ambient occlusion, NO highlights or reflections';
  }
  if (map === 'height') return 'a greyscale height map: white is high, black is low, mid grey is the flat level; greyscale only, no colour, no lighting';
  return 'a tangent-space normal map in the OpenGL convention (+Y up): mostly blue, flat areas are RGB 128, 128, 255, surface relief only, no lighting, no shadows';
}

const mapName = (map: PlanMap, colorMode: ColorModeName): string => (map === 'albedo' ? (colorMode === 'diffuse' ? 'diffuse' : 'albedo') : map);

/** R36: a follower says the attached image is the albedo of the same material, and each of its maps follows the albedo's features. */
function describeFollowing(maps: readonly PlanMap[]): string {
  const parts = ['The attached image is the albedo of the same material; the output must match its features and its layout of detail.'];
  if (maps.includes('normal')) parts.push('The relief of the normal map follows the features of the albedo.');
  if (maps.includes('height')) parts.push('The high and low areas of the height map follow the features of the albedo.');
  return parts.join(' ');
}

/** R35: how the maps sit on the canvas, in words: quadrants for 2x2, left to right or top to bottom for the other grids. */
function describeArrangement(layout: PackedLayout, names: readonly string[]): string {
  const { cols, rows } = layout.grid;
  const count = names.length;
  const grid = `arranged in a grid of ${cols} column${cols === 1 ? '' : 's'} and ${rows} row${rows === 1 ? '' : 's'}`;
  if (cols === 2 && rows === 2) {
    const quadrants = ['top-left', 'top-right', 'bottom-left'];
    return `${grid}, one map per quadrant: ${names.map((name, index) => `${quadrants[index]} ${name}`).join(', ')}.`;
  }
  const direction = rows === 1 ? 'left to right' : 'top to bottom';
  return `${grid}, in reading order from ${direction}: ${names.map((name, index) => `${ORDINALS[index]} ${name}`).join(', ')}${count > 0 ? '.' : ''}`;
}

function buildRecipe({ maps, layout, colorMode, follower }: Omit<MapPromptInput, 'userText'>): string {
  const names = maps.map((map) => `${mapName(map, colorMode)} map`);
  const parts: string[] = [];
  if (maps.length === 1) {
    parts.push(`Generate the ${names[0]} of ${TOP_DOWN}: ${describeMap(maps[0]!, colorMode)}.`);
  } else {
    parts.push(`Generate an image comprised of ${maps.length} maps of ${TOP_DOWN}, ${describeArrangement(layout, names)} Maps have no separators or labels, just the seamless texture maps equal in size.`);
    maps.forEach((map, index) => parts.push(`The ${ORDINALS[index]} map is the ${names[index]}: ${describeMap(map, colorMode)}.`));
    if (layout.emptyCells > 0) parts.push('The remaining space is plain mid grey.');
  }
  if (follower) parts.push(describeFollowing(maps));
  return parts.join(' ');
}

/**
 * Generation R31-R36, R38: the prompt of a map image: the recipe of its maps, the tileability text, then the user's text verbatim ("Material: ..." when it has a
 * non-space character). The text is built before the call and is what the run log shows (R68); the adapter adds nothing.
 */
export function buildMapPrompt(input: MapPromptInput): string {
  const names = input.maps.map((map) => `${mapName(map, input.colorMode)} map`);
  const sections = [buildRecipe(input), input.maps.length > 1 ? `${TILEABLE_SENTENCE} ${describePackedTiling(input.layout, names)}` : TILEABLE_SENTENCE];
  if (input.userText.trim() !== '') sections.push(`Material: ${input.userText}`);
  return sections.join('\n\n');
}

/** R37: the decomposition prompt is the masks prompt, unchanged, with no user text, and the tileability sentence appended. */
export function buildDecompositionImagePrompt(masksPrompt: string): string {
  return `${masksPrompt}\n\n${TILEABLE_SENTENCE}`;
}
