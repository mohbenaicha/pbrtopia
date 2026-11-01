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

describe('mapRecipes: the atlas render (R39)', () => {
  it('R39 with the grey render the albedo focus keeps the grey sentence', () => {
    const focus = recipeForChannel('albedo', 'grey').enhancerFocus;
    expect(focus).toMatch(/plain grey renders/);
    expect(focus).toMatch(/never report the grey/);
  });

  it('R39 with the viewport render the focus says the snapshots show the model as the viewport did, and drops the grey sentence', () => {
    const focus = recipeForChannel('albedo', 'viewport').enhancerFocus;
    expect(focus).not.toMatch(/plain grey renders/);
    expect(focus).not.toMatch(/never report the grey/);
    expect(focus).toMatch(/as it looked in the user's viewport/);
    expect(focus).toMatch(/wireframe/);
  });

  it('R39 both focuses keep the no-lighting wording and the user decides colours when the two disagree', () => {
    for (const render of ['grey', 'viewport'] as const) {
      const focus = recipeForChannel('albedo', render).enhancerFocus;
      expect(focus, render).toMatch(/Say nothing about lighting, shadows, shine or reflections/);
      expect(focus, render).toMatch(/colours, materials and patterns come from the user's prompt/);
    }
  });

  it('R39 the render changes only the enhancer focus: the text before and after are the same', () => {
    const grey = recipeForChannel('albedo', 'grey');
    const viewport = recipeForChannel('albedo', 'viewport');
    expect(viewport.textBefore).toBe(grey.textBefore);
    expect(viewport.textAfter).toBe(grey.textAfter);
  });
});

describe('mapRecipes: the depth renders (R39)', () => {
  it('R39 the depth and depth + wireframe renders use the focus of the grey render, with no new wording yet', () => {
    const grey = recipeForChannel('albedo', 'grey');
    expect(recipeForChannel('albedo', 'depth')).toEqual(grey);
    expect(recipeForChannel('albedo', 'depth-wireframe')).toEqual(grey);
  });
});

describe('mapRecipes: the wireframe render (R39)', () => {
  it('R39 the wireframe focus says the snapshots are grey with thin dark wireframe lines that only show the geometry', () => {
    const focus = recipeForChannel('albedo', 'wireframe').enhancerFocus;
    expect(focus).toMatch(/plain grey renders/);
    expect(focus).toMatch(/wireframe/);
    expect(focus).toMatch(/only show the geometry/);
    expect(focus).toMatch(/never report the grey, its shading or the lines as a colour, a pattern or surface detail/);
    expect(focus).toMatch(/Say nothing about lighting, shadows, shine or reflections/);
    expect(focus).toMatch(/colours, materials and patterns come from the user's prompt/);
  });

  it('R39 the three renders have three different focuses and the same text before and after', () => {
    const recipes = (['grey', 'wireframe', 'viewport'] as const).map((render) => recipeForChannel('albedo', render));
    expect(new Set(recipes.map((recipe) => recipe.enhancerFocus)).size).toBe(3);
    expect(new Set(recipes.map((recipe) => recipe.textAfter)).size).toBe(1);
  });
});
