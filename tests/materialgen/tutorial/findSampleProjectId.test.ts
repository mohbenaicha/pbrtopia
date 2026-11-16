import { describe, expect, it } from 'vitest';
import { findSampleProjectId } from '../../../src/materialgen/tutorial/findSampleProjectId';

const store = (names: Array<[string, string]>, fail = false) => ({
  listProjects: async () => (fail ? { ok: false as const, error: { message: 'x' } } : { ok: true as const, value: names.map(([id, name]) => ({ id, name })) }),
});

describe('finding the sample project the tour runs in (tutorial R4)', () => {
  it('TestR4_picks_the_first_bundled_sample_by_name_ignoring_case_and_hyphens', async () => {
    const found = await findSampleProjectId(store([['a', 'My own'], ['b', 'rocky desert'], ['c', 'Corrugated Metal']]), ['Corrugated-Metal', 'Rocky-Desert']);
    expect(found).toBe('c');
  });

  it('TestR4_never_falls_back_to_the_users_own_project', async () => {
    expect(await findSampleProjectId(store([['a', 'My own']]), ['Corrugated-Metal'])).toBeNull();
  });

  it('TestR8_a_list_that_cannot_be_read_gives_no_sample', async () => {
    expect(await findSampleProjectId(store([], true), ['Corrugated-Metal'])).toBeNull();
  });
});
