import { describe, expect, it } from 'vitest';
import { buildSheetImagePrompt } from '../../../src/generation/custom/sheetPrompt';
import { buildEnhancerText } from '../../../src/generation/prompts/buildEnhancerText';
import { buildImagePrompt } from '../../../src/generation/prompts/buildImagePrompt';
import { IMAGE_OPENING } from '../../../src/generation/prompts/framePrompt';
import { recipeForChannel } from '../../../src/generation/prompts/mapRecipes';
import { describeViewMarks, IGNORE_VIEW_MARKS } from '../../../src/generation/prompts/viewMarksWording';
import { buildMaskDescribeText, MASK_DECOMPOSITION_FRAMING } from '../../../src/generation/masks/maskPrompts';
import { OBJECT_SIDES } from '../../../src/viewMarks';

const recipe = recipeForChannel('albedo');
const sheet = { recipe, description: 'A robot.', referenceCount: 0, leadCameras: null, tiles: [{ camera: 0, centerX: 0.5, centerY: 0.5 }] };

describe('view marks wording', () => {
  it('R7 names every side with its colour and letter, and forbids the marks in the result', () => {
    const note = describeViewMarks();
    for (const side of OBJECT_SIDES) expect(note).toContain(`${side.colourName} = ${side.name}`);
    for (const side of OBJECT_SIDES) expect(note).toContain(`${side.letter} = ${side.name}`);
    expect(note).toMatch(/grid/i);
    expect(note).toMatch(/must not appear/i);
    expect(note).toMatch(/without a letter/i);
  });

  it('R7 the note comes right after the opening, for the atlas and for a custom core sheet', () => {
    const start = `${IMAGE_OPENING}\n\n${describeViewMarks()}\n\n`;
    expect(buildImagePrompt({ recipe, description: 'A robot.', referenceCount: 1 }).startsWith(start)).toBe(true);
    expect(buildSheetImagePrompt({ ...sheet, aux: false }).startsWith(start)).toBe(true);
  });

  it('R7 an auxiliary-only sheet and the mask prompt do not carry it', () => {
    expect(buildSheetImagePrompt({ ...sheet, aux: true, tiles: [] })).not.toContain(describeViewMarks());
    expect(`${MASK_DECOMPOSITION_FRAMING}${buildMaskDescribeText('')}`).not.toContain(describeViewMarks());
  });

  it('R8 the enhancer is told to ignore the marks', () => {
    expect(buildEnhancerText(recipe, 'rusty')).toContain(IGNORE_VIEW_MARKS);
    expect(buildEnhancerText(recipe, '', 'object')).toContain(IGNORE_VIEW_MARKS);
    expect(IGNORE_VIEW_MARKS).toMatch(/ignore/i);
  });
});
