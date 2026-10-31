import type { AtlasRender } from '../atlasRender';

// R30, R32: what depends on the map being made. A recipe holds prompt wording only; the steps a later map needs besides (a segmentation
// converted to values, other checks) come with that map.
export interface MapRecipe {
  channel: RecipeChannel;
  enhancerFocus: string; // what the enhancer takes from the image and from the user, and what it leaves out
  textBefore: string; // the map's prefix: placed before the description in the image prompt (may be empty)
  textAfter: string; // the map's postfix: placed after the description in the image prompt (may be empty)
}

// The channels that have a recipe; the type makes a channel without one a compile error.
export type RecipeChannel = 'albedo';

const ALBEDO_FOCUS_START = "The shape of the object and where each feature lies come from the image; its colours, materials and patterns come from the user's prompt and are kept as written.";
const ALBEDO_FOCUS_END = 'Say nothing about lighting, shadows, shine or reflections.';

// R39: the focus follows how the snapshots were drawn. With the viewport render, what the pictures show is really on the model.
const ALBEDO_FOCUS: Record<AtlasRender, string> = {
  grey: `${ALBEDO_FOCUS_START} The snapshots are plain grey renders, so never report the grey or its shading as a colour. ${ALBEDO_FOCUS_END}`,
  wireframe: `${ALBEDO_FOCUS_START} The snapshots are plain grey renders with the mesh's wireframe drawn over them as thin dark lines; the lines only show the geometry, so never report the grey, its shading or the lines as a colour, a pattern or surface detail. ${ALBEDO_FOCUS_END}`,
  viewport: `${ALBEDO_FOCUS_START} The snapshots show the model as it looked in the user's viewport, so the colours, textures or wireframe lines they show are really on the model and may be described; where they disagree with the user's prompt, the prompt decides. ${ALBEDO_FOCUS_END}`,
};

const ALBEDO_TEXT_AFTER = 'Flat unlit albedo texture, no shadows, no highlights, no specular, no ambient occlusion, no depth or perspective.';

const RECIPES: Record<RecipeChannel, (render: AtlasRender) => MapRecipe> = {
  albedo: (render) => ({ channel: 'albedo', enhancerFocus: ALBEDO_FOCUS[render], textBefore: '', textAfter: ALBEDO_TEXT_AFTER }),
};

export const RECIPE_CHANNELS: readonly RecipeChannel[] = ['albedo'];

export const recipeForChannel = (channel: RecipeChannel, render: AtlasRender = 'grey'): MapRecipe => RECIPES[channel](render);

/** R30: whether a channel (by name, as the panel's toggle names them) has a recipe, so the toggle may enable it. */
export const hasRecipe = (channel: string): channel is RecipeChannel => RECIPE_CHANNELS.some((candidate) => candidate === channel);
