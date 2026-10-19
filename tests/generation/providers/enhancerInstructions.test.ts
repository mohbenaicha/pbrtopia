import { describe, expect, it } from 'vitest';
import { buildEnhancerText, ENHANCER_INSTRUCTION } from '../../../src/generation/providers/enhancerInstructions';

// The text the user supplied on 2026-10-17 (specs/generation/generate/spec.md R8).
const SPEC_TEXT =
  'Enhance this user prompt by describing what you see in the 3D image snapshots provided. Mention features and where they lie relative to the overall model (e.g. left, right, top). Describe each feature briefly without over-interpreting or over-complicating. Mention multiple instances when there are several (e.g. left hand, right hand, chest pocket, pant pocket, left window, back window). Keep the overall description to 100 words or less.';

describe('enhancerInstructions', () => {
  it('R8 the instruction is the text the user supplied, word for word', () => {
    expect(ENHANCER_INSTRUCTION).toBe(SPEC_TEXT);
  });

  it('R8 the user\'s prompt is appended after the instruction, on a new paragraph', () => {
    expect(buildEnhancerText('a rusty robot')).toBe(`${SPEC_TEXT}\n\na rusty robot`);
  });

  it('R8 the prompt is trimmed, and its inner text is kept as typed', () => {
    expect(buildEnhancerText('  a rusty robot\nwith blue eyes  ')).toBe(`${SPEC_TEXT}\n\na rusty robot\nwith blue eyes`);
  });

  it('R8 an empty or blank prompt gives the instruction alone', () => {
    expect(buildEnhancerText('')).toBe(SPEC_TEXT);
    expect(buildEnhancerText('   \n ')).toBe(SPEC_TEXT);
  });
});
