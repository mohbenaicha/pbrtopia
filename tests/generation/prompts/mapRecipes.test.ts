import { describe, expect, it } from 'vitest';
import { RECIPE_CHANNELS, hasRecipe, recipeForChannel, type RecipeChannel } from '../../../src/generation/prompts/mapRecipes';

describe('mapRecipes', () => {
  it('R30 the albedo recipe is the only recipe, and it belongs to the albedo channel', () => {
    expect(RECIPE_CHANNELS).toEqual(['albedo']);
    expect(recipeForChannel('albedo').channel).toBe('albedo');
  });

  it('R30 hasRecipe says which channels the toggle may enable', () => {
    expect(hasRecipe('albedo')).toBe(true);
    expect(hasRecipe('normal')).toBe(false);
    expect(hasRecipe('roughness')).toBe(false);
  });

  it('R30 a channel without a recipe does not compile', () => {
    // @ts-expect-error normal has no recipe yet
    const missing: RecipeChannel = 'normal';
    expect(missing).toBe('normal');
  });

  it('R32 albedo: no text before, the user\'s text after, and a focus that keeps the user\'s colours and leaves lighting out', () => {
    const recipe = recipeForChannel('albedo');
    expect(recipe.textBefore).toBe('');
    expect(recipe.textAfter).toBe('Flat unlit albedo texture, no shadows, no highlights, no specular, no ambient occlusion, no depth or perspective.');
    expect(recipe.enhancerFocus).toMatch(/colours, materials and patterns come from the user's prompt/);
    expect(recipe.enhancerFocus).toMatch(/never .* the grey/);
    expect(recipe.enhancerFocus).toMatch(/lighting, shadows, shine or reflections/);
  });
});
