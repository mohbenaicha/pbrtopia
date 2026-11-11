import { describe, expect, it } from 'vitest';
import { buildIdeasText, IDEAS_INSTRUCTION } from '@mat/generation/ideas/buildIdeasText';

describe('buildIdeasText', () => {
  it('materialgen/generation R72 the text is the fixed instruction, a blank line, then the user text verbatim', () => {
    expect(buildIdeasText('weathered steel')).toBe(`${IDEAS_INSTRUCTION}\n\nweathered steel`);
    expect(buildIdeasText('  two  spaces\nand a line  ')).toBe(`${IDEAS_INSTRUCTION}\n\n  two  spaces\nand a line  `);
  });

  it('materialgen/generation R72 the instruction asks for exactly 3 ideas of 10 to 50 words as a JSON array of strings only', () => {
    expect(IDEAS_INSTRUCTION).toMatch(/exactly 3/);
    expect(IDEAS_INSTRUCTION).toMatch(/10 to 50 words/);
    expect(IDEAS_INSTRUCTION).toMatch(/JSON array of 3 strings/);
    expect(IDEAS_INSTRUCTION).toMatch(/seamless/);
  });
});
