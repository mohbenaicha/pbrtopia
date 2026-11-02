import { describe, expect, it } from 'vitest';
import { IMAGE_CLOSING, IMAGE_OPENING } from '../../../src/generation/prompts/framePrompt';
import { recipeForChannel } from '../../../src/generation/prompts/mapRecipes';
import { buildSheetImagePrompt, describeSheetCaption, describeTilePlace } from '../../../src/generation/custom/sheetPrompt';

const recipe = recipeForChannel('albedo');

describe('describeSheetCaption', () => {
  it('custom R14 names the cameras in core order, joined', () => {
    expect(describeSheetCaption([3, 1])).toBe('Right, Left');
    expect(describeSheetCaption([0])).toBe('Front');
  });

  it('custom R27 the aux sheet is captioned Auxiliary', () => {
    expect(describeSheetCaption([], 'aux')).toBe('Auxiliary');
  });
});

describe('describeTilePlace', () => {
  it('custom R14 names the place of a tile centre on the canvas', () => {
    expect(describeTilePlace(0.25, 0.5)).toBe('left');
    expect(describeTilePlace(0.75, 0.5)).toBe('right');
    expect(describeTilePlace(0.5, 0.2)).toBe('top');
    expect(describeTilePlace(0.5, 0.8)).toBe('bottom');
    expect(describeTilePlace(0.2, 0.2)).toBe('top-left');
    expect(describeTilePlace(0.8, 0.8)).toBe('bottom-right');
    expect(describeTilePlace(0.5, 0.5)).toBe('centre');
  });
});

describe('buildSheetImagePrompt', () => {
  const base = { recipe, description: 'A knight in plate armour.', referenceCount: 0, leadCameras: null, aux: false };

  it('custom R14 names each tile and its place', () => {
    const text = buildSheetImagePrompt({ ...base, tiles: [{ camera: 3, centerX: 0.25, centerY: 0.5 }, { camera: 1, centerX: 0.75, centerY: 0.5 }] });
    expect(text).toContain('left tile: the Left view');
    expect(text).toContain('right tile: the Right view');
  });

  it('custom R14 a single tile is named without a place', () => {
    const text = buildSheetImagePrompt({ ...base, tiles: [{ camera: 0, centerX: 0.5, centerY: 0.5 }] });
    expect(text).toContain('one tile: the Front view');
  });

  it('custom R14 a follow-up sheet names the lead views and treats image 2 as a reference', () => {
    const text = buildSheetImagePrompt({ ...base, referenceCount: 1, leadCameras: [1, 3], tiles: [{ camera: 2, centerX: 0.5, centerY: 0.5 }] });
    expect(text).toContain('the Right and Left views');
    expect(text).toContain('Image 2');
    expect(text).toContain('colours, materials and style');
  });

  it('custom R14 the lead sheet has no lead reference note', () => {
    const text = buildSheetImagePrompt({ ...base, tiles: [{ camera: 0, centerX: 0.5, centerY: 0.5 }] });
    expect(text).not.toContain('already textured');
  });

  it('custom R14 the lead sheet keeps the user references note', () => {
    const text = buildSheetImagePrompt({ ...base, referenceCount: 2, tiles: [{ camera: 0, centerX: 0.5, centerY: 0.5 }] });
    expect(text).toContain('Images 2 to 3 are references only');
  });

  it('custom R14 the aux sheet says the tiles are extra viewpoints', () => {
    const text = buildSheetImagePrompt({ ...base, aux: true, referenceCount: 1, leadCameras: [0], tiles: [] });
    expect(text).toContain('extra viewpoints of the same object');
  });

  it('custom R14 keeps the opening, the recipe, the description and the closing in order', () => {
    const text = buildSheetImagePrompt({ ...base, tiles: [{ camera: 0, centerX: 0.5, centerY: 0.5 }] });
    const order = [IMAGE_OPENING, 'one tile', base.description, recipe.textAfter, IMAGE_CLOSING].map((part) => text.indexOf(part));
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);
  });
});
