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

const ALBEDO_RECIPE: MapRecipe = {
  channel: 'albedo',
  enhancerFocus:
    "The shape of the object and where each feature lies come from the image; its colours, materials and patterns come from the user's prompt and are kept as written. The snapshots are plain grey renders, so never report the grey or its shading as a colour. Say nothing about lighting, shadows, shine or reflections.",
  textBefore: '',
  textAfter: 'Flat unlit albedo texture, no shadows, no highlights, no specular, no ambient occlusion, no depth or perspective.',
};

const RECIPES: Record<RecipeChannel, MapRecipe> = { albedo: ALBEDO_RECIPE };

export const RECIPE_CHANNELS: readonly RecipeChannel[] = ['albedo'];

export const recipeForChannel = (channel: RecipeChannel): MapRecipe => RECIPES[channel];

/** R30: whether a channel (by name, as the panel's toggle names them) has a recipe, so the toggle may enable it. */
export const hasRecipe = (channel: string): channel is RecipeChannel => RECIPE_CHANNELS.some((candidate) => candidate === channel);
