import { describe, expect, it } from 'vitest';
import { IDEAS_UNREADABLE, parseIdeas } from '@mat/generation/ideas/parseIdeas';

describe('parseIdeas', () => {
  it('materialgen/generation R72 reads a JSON array of three strings', () => {
    expect(parseIdeas('["a b", "c d", "e f"]')).toEqual({ ok: true, ideas: ['a b', 'c d', 'e f'] });
  });

  it('materialgen/generation R72 reads a code-fenced array and an object with an ideas array', () => {
    expect(parseIdeas('```json\n["one", "two", "three"]\n```')).toEqual({ ok: true, ideas: ['one', 'two', 'three'] });
    expect(parseIdeas('{"ideas": ["one", "two", "three"]}')).toEqual({ ok: true, ideas: ['one', 'two', 'three'] });
  });

  it('materialgen/generation R72 trims ideas, drops blanks and non-strings, and keeps the first three', () => {
    expect(parseIdeas('["  one ", "", 7, "two", "three", "four"]')).toEqual({ ok: true, ideas: ['one', 'two', 'three'] });
  });

  it('materialgen/generation R72 exact duplicates are dropped before the first three are kept, and an idea of any length is kept', () => {
    expect(parseIdeas('["a", "a", "b", "c", "d"]')).toEqual({ ok: true, ideas: ['a', 'b', 'c'] });
    expect(parseIdeas('["a", "a ", "b"]')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
    const long = Array.from({ length: 80 }, (_, at) => `w${at}`).join(' ');
    expect(parseIdeas(JSON.stringify([long, 'b', 'c']))).toEqual({ ok: true, ideas: [long, 'b', 'c'] });
  });

  it('materialgen/generation R72 fewer than three usable ideas, or text that is not JSON, is the unreadable error', () => {
    expect(parseIdeas('["one", "two"]')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
    expect(parseIdeas('["one", " ", "two"]')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
    expect(parseIdeas('Here are some ideas: rusty metal')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
    expect(parseIdeas('')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
    expect(parseIdeas('{"ideas": "not an array"}')).toEqual({ ok: false, message: IDEAS_UNREADABLE });
  });

  it('materialgen/generation R72 the unreadable message is the spec wording', () => {
    expect(IDEAS_UNREADABLE).toBe('The ideas could not be read. Try again.');
  });
});
