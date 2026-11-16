// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createTourSeenStorage } from '../../src/tutorial/tourSeen';

afterEach(() => {
  window.localStorage.clear();
  vi.restoreAllMocks();
});

describe('tour seen flag (tutorial R2)', () => {
  it('TestR2_is_unseen_until_written_then_seen_under_its_key', () => {
    const seen = createTourSeenStorage('material-lab.tutorial.done');
    expect(seen.read()).toBe(false);
    seen.write();
    expect(seen.read()).toBe(true);
    expect(Object.keys(window.localStorage)).toEqual(['material-lab.tutorial.done']);
  });

  it('TestR2_a_flag_written_by_an_earlier_page_is_read', () => {
    window.localStorage.setItem('k', '1');
    expect(createTourSeenStorage('k').read()).toBe(true);
  });

  it('TestR2_blocked_storage_reads_unseen_but_remembers_for_the_page_life', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => { throw new Error('blocked'); });
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('blocked'); });
    const seen = createTourSeenStorage('k');
    expect(seen.read()).toBe(false);
    seen.write();
    expect(seen.read()).toBe(true);
  });
});
