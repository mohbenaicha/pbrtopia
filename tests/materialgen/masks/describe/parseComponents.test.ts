import { describe, expect, it } from 'vitest';
import { parseComponents } from '@mat/masks/describe/parseComponents';

const part = (name: string) => ({ name, description: `${name} looks`, location: `${name} lies` });
const json = (count: number) => JSON.stringify(Array.from({ length: count }, (_, i) => part(`part ${i + 1}`)));

function components(text: string) {
  const result = parseComponents(text);
  if (!result.ok) throw new Error(`not ok: ${result.problem}`);
  return result.components;
}

describe('materialgen/masks parseComponents', () => {
  it('R3 plain JSON, a fenced reply with chatter around it, an object holding the array, and extra fields are all read', () => {
    expect(components(json(3))).toHaveLength(3);
    expect(components(`Sure! \`\`\`json\n${json(4)}\n\`\`\` Hope that helps.`)).toHaveLength(4);
    expect(components(JSON.stringify({ components: JSON.parse(json(3)) }))).toHaveLength(3);
    expect(components(JSON.stringify([{ ...part('a'), extra: 1 }, part('b'), part('c')]))[0]).toEqual(part('a'));
  });

  it('R3 strings are trimmed', () => {
    const [first] = components(JSON.stringify([{ name: '  moss ', description: ' green  ', location: ' top ' }, part('b'), part('c')]));
    expect(first).toEqual({ name: 'moss', description: 'green', location: 'top' });
  });

  it('R4 a missing or empty name becomes Component k, counted from 1 by position', () => {
    const list = components(JSON.stringify([part('a'), { description: 'x', location: 'y' }, { name: '  ', description: '', location: '' }]));
    expect(list.map((entry) => entry.name)).toEqual(['a', 'Component 2', 'Component 3']);
  });

  it('R4 a duplicate name gets 2, 3 and so on, and a missing description or location becomes empty text', () => {
    const list = components(JSON.stringify([{ name: 'moss' }, { name: 'moss' }, { name: 'moss', description: 'd' }]));
    expect(list.map((entry) => entry.name)).toEqual(['moss', 'moss 2', 'moss 3']);
    expect(list[0]).toEqual({ name: 'moss', description: '', location: '' });
  });

  it('R6 fewer than 3 or more than 10 components fail, after the repairs of R4, with the sentence the retry sends', () => {
    expect(parseComponents(json(2))).toEqual({ ok: false, problem: 'too-few', hint: 'Return between 3 and 10 components.' });
    expect(parseComponents(json(12))).toEqual({ ok: false, problem: 'too-many', hint: 'Return between 3 and 10 components.' });
    expect(parseComponents(json(10)).ok).toBe(true);
    expect(parseComponents(json(3)).ok).toBe(true);
  });

  it('R6 text with no parsable JSON fails and says to return only JSON', () => {
    expect(parseComponents('I cannot see any picture.')).toEqual({ ok: false, problem: 'unparsable', hint: 'Return only the JSON array of components.' });
    expect(parseComponents('{"components": ').ok).toBe(false);
    expect(parseComponents('[1, 2, 3]').ok).toBe(false);
  });
});
