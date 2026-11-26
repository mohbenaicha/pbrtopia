import { describe, expect, it } from 'vitest';
import { buildEnhancerText } from '../../../src/generation/prompts/buildEnhancerText';
import { ENHANCER_INSTRUCTION } from '../../../src/generation/prompts/framePrompt';
import { recipeForChannel } from '../../../src/generation/prompts/mapRecipes';
import { IGNORE_VIEW_MARKS } from '../../../src/generation/prompts/viewMarksWording';

const recipe = recipeForChannel('albedo');
const head = `${ENHANCER_INSTRUCTION} ${IGNORE_VIEW_MARKS}\n\n${recipe.enhancerFocus}`;

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

describe('buildEnhancerText: the whole object (custom R15)', () => {
  it('custom R15 for the object scope the instruction also asks for the sides no view shows; the default text is unchanged', () => {
    const whole = buildEnhancerText(recipe, 'a rusty robot', 'object');
    expect(whole).toContain(ENHANCER_INSTRUCTION);
    expect(whole).toMatch(/whole object, not only the side/i);
    expect(whole.indexOf('whole object')).toBeLessThan(whole.indexOf('User prompt:'));
    expect(buildEnhancerText(recipe, 'a rusty robot')).not.toMatch(/whole object/i);
    expect(buildEnhancerText(recipe, 'a rusty robot', 'atlas')).toBe(buildEnhancerText(recipe, 'a rusty robot'));
  });
});

describe('buildEnhancerText: the atlas render (R39)', () => {
  it('R39 the viewport render puts its own focus in the request, and not the grey one', () => {
    const viewport = recipeForChannel('albedo', 'viewport');
    const text = buildEnhancerText(viewport, 'a rusty robot');
    expect(text).toBe(`${ENHANCER_INSTRUCTION} ${IGNORE_VIEW_MARKS}\n\n${viewport.enhancerFocus}\n\nUser prompt:\na rusty robot`);
    expect(text).not.toContain(recipeForChannel('albedo', 'grey').enhancerFocus);
  });
});
