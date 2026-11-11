import { describe, expect, it } from 'vitest';
import { readCachedModelLists } from '../../../src/shell/settings/cachedModelLists';

const entry = (provider: string, id: string, extra: Record<string, unknown> = {}): Record<string, unknown> => ({ provider, id, displayName: `Name ${id}`, role: 'vision-text', verified: true, resolutions: [], qualityLevels: [], ...extra });
const cache = (gemini: Record<string, unknown>[], openai: Record<string, unknown>[]) => ({ fetchedAt: '2026-10-21T10:00:00.000Z', gemini, openai });

describe('readCachedModelLists', () => {
  it('settings R6 no cache gives no lists', () => {
    expect(readCachedModelLists(null)).toEqual({});
  });

  it('settings R6 keeps well-formed entries of each provider', () => {
    const lists = readCachedModelLists(cache([entry('gemini', 'g1')], [entry('openai', 'o1'), entry('openai', 'o2', { role: 'image' })]));
    expect(lists.gemini?.map((model) => model.id)).toEqual(['g1']);
    expect(lists.openai?.map((model) => model.id)).toEqual(['o1', 'o2']);
  });

  it('settings R6 drops malformed entries: wrong provider, no id, bad role, non-boolean verified', () => {
    const lists = readCachedModelLists(
      cache(
        [entry('openai', 'wrong-list'), entry('gemini', ''), entry('gemini', 'bad-role', { role: 'audio' }), entry('gemini', 'bad-verified', { verified: 'yes' }), entry('gemini', 'good')],
        [],
      ),
    );
    expect(lists.gemini?.map((model) => model.id)).toEqual(['good']);
  });

  it('settings R6 a missing displayName falls back to the id, missing arrays to empty', () => {
    const lists = readCachedModelLists(cache([{ provider: 'gemini', id: 'bare', role: 'image', verified: false }], []));
    expect(lists.gemini).toEqual([{ provider: 'gemini', id: 'bare', displayName: 'bare', role: 'image', verified: false, resolutions: [], qualityLevels: [] }]);
  });

  it('settings R6 a provider with no valid entry is absent, so the shipped table applies to it', () => {
    const lists = readCachedModelLists(cache([], [entry('gemini', 'misfiled')]));
    expect(lists).toEqual({});
  });
});
