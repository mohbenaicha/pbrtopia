import { describe, expect, it } from 'vitest';
import { ENHANCER_INSTRUCTION, IMAGE_CLOSING, IMAGE_OPENING, describeReferences } from '../../../src/generation/prompts/framePrompt';

// The text of specs/generation/generate/spec.md R8 (the user's text of 2026-10-17, reworded 2026-10-23: one object on one sheet).
const SPEC_TEXT =
  'Enhance this user prompt by describing what you see in the 3D image snapshots provided. The snapshots are several views of one single object, laid out on one sheet: describe that one object, never the sheet or its views, and count each feature once however many views show it (an object with one staff has one staff). Mention features and where they lie relative to the overall model (e.g. left, right, top, front, back). Describe each feature briefly without over-interpreting or over-complicating. Mention multiple instances only when the object itself has several (e.g. left hand and right hand, two windows). Keep the overall description to 100 words or less.';

describe('framePrompt', () => {
  it('R8 the shared enhancer instruction is the spec text, word for word', () => {
    expect(ENHANCER_INSTRUCTION).toBe(SPEC_TEXT);
  });

  it('R31 the opening names image 1 and the closing keeps the shape, as the user wrote them', () => {
    expect(IMAGE_OPENING).toBe('Texture image 1 (the first image provided) in place, meaning all the 3D model perspectives in it are textured in place, accurately following the geometry and staying consistent among the perspectives.');
    expect(IMAGE_CLOSING).toBe('Do not change the shape or position or contour of the model, maintain structural integrity and consistency across all perspectives strictly.');
  });

  it('R31 no reference gives no note', () => {
    expect(describeReferences(0)).toBe('');
  });

  it('R31 one reference is image 2, several are images 2 to N with N = 1 + the count, as a numeral', () => {
    expect(describeReferences(1)).toMatch(/^Image 2 is a reference only\./);
    expect(describeReferences(2)).toMatch(/^Images 2 to 3 are references only\./);
    expect(describeReferences(13)).toMatch(/^Images 2 to 14 are references only\./);
  });

  it('R31 the note says to use references as a guide, not to texture them and not to paste them into the result', () => {
    const note = describeReferences(2);
    expect(note).toContain('as a guide for how the surfaces should look');
    expect(note).toContain('Do not texture them');
    expect(note).toContain('do not paste the reference pictures or their layout into the result');
  });
});
