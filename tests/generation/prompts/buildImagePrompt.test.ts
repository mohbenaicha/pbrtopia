import { describe, expect, it } from 'vitest';
import { buildImagePrompt } from '../../../src/generation/prompts/buildImagePrompt';
import { IMAGE_CLOSING, IMAGE_OPENING, describeReferences } from '../../../src/generation/prompts/framePrompt';
import { recipeForChannel, type MapRecipe } from '../../../src/generation/prompts/mapRecipes';
import { describeViewMarks } from '../../../src/generation/prompts/viewMarksWording';

const albedo = recipeForChannel('albedo');
const DESCRIPTION = 'A green lizard-like humanoid with black dreadlocks.';

describe('buildImagePrompt', () => {
  it('R34 no references: the opening, the description, the albedo text after and the closing, nothing about references', () => {
    const prompt = buildImagePrompt({ recipe: albedo, description: DESCRIPTION, referenceCount: 0 });
    expect(prompt).toBe([IMAGE_OPENING, describeViewMarks(), DESCRIPTION, albedo.textAfter, IMAGE_CLOSING].join('\n\n'));
    expect(prompt).not.toMatch(/reference/i);
  });

  it('R34 references: the note comes after the opening and before the description', () => {
    const prompt = buildImagePrompt({ recipe: albedo, description: DESCRIPTION, referenceCount: 2 });
    expect(prompt).toBe([IMAGE_OPENING, describeViewMarks(), describeReferences(2), DESCRIPTION, albedo.textAfter, IMAGE_CLOSING].join('\n\n'));
  });

  it('R34 a recipe\'s text before sits between the references note and the description', () => {
    const recipe: MapRecipe = { ...albedo, textBefore: 'Legend: rust is blue.' };
    const prompt = buildImagePrompt({ recipe, description: DESCRIPTION, referenceCount: 1 });
    expect(prompt).toBe([IMAGE_OPENING, describeViewMarks(), describeReferences(1), 'Legend: rust is blue.', DESCRIPTION, albedo.textAfter, IMAGE_CLOSING].join('\n\n'));
  });

  it('R34 parts are trimmed and empty parts are left out', () => {
    const recipe: MapRecipe = { ...albedo, textAfter: '  ' };
    const prompt = buildImagePrompt({ recipe, description: `  ${DESCRIPTION}\n\n`, referenceCount: 0 });
    expect(prompt).toBe([IMAGE_OPENING, describeViewMarks(), DESCRIPTION, IMAGE_CLOSING].join('\n\n'));
  });

  it('R34 the same inputs give the same text', () => {
    const input = { recipe: albedo, description: DESCRIPTION, referenceCount: 3 };
    expect(buildImagePrompt(input)).toBe(buildImagePrompt({ ...input }));
  });
});
