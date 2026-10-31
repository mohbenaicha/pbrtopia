import { describe, expect, it } from 'vitest';
import { buildEnhancerText } from '../../../src/generation/prompts/buildEnhancerText';
import { ENHANCER_INSTRUCTION } from '../../../src/generation/prompts/framePrompt';
import { recipeForChannel } from '../../../src/generation/prompts/mapRecipes';

const recipe = recipeForChannel('albedo');
const head = `${ENHANCER_INSTRUCTION}\n\n${recipe.enhancerFocus}`;

describe('buildEnhancerText', () => {
  it('R33 the shared instruction, the recipe focus, then the user\'s prompt under its label', () => {
    expect(buildEnhancerText(recipe, 'a rusty robot')).toBe(`${head}\n\nUser prompt:\na rusty robot`);
  });

  it('R33 the prompt is trimmed, and its inner text is kept as typed', () => {
    expect(buildEnhancerText(recipe, '  a rusty robot\nwith blue eyes  ')).toBe(`${head}\n\nUser prompt:\na rusty robot\nwith blue eyes`);
  });

  it('R33 an empty or blank prompt leaves out the label and ends with the focus', () => {
    expect(buildEnhancerText(recipe, '')).toBe(head);
    expect(buildEnhancerText(recipe, '   \n ')).toBe(head);
  });

  it('R33 the focus never comes after the user label, so it cannot be read as the prompt', () => {
    const text = buildEnhancerText(recipe, 'a rusty robot');
    expect(text.indexOf(recipe.enhancerFocus)).toBeLessThan(text.indexOf('User prompt:'));
  });
});
