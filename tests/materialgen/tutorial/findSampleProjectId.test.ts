import { describe, expect, it } from 'vitest';
import { findSampleProjectId, findSampleProjectWhenImported } from '../../../src/materialgen/tutorial/findSampleProjectId';

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

describe('waiting for the background import (tutorial R21)', () => {
  it('TestR21_waits_while_the_import_runs_and_returns_the_sample_once_it_is_in', async () => {
    const names: Array<[string, string]> = [];
    let pending = true;
    const waiting = findSampleProjectWhenImported(store(names), () => pending, ['Corrugated-Metal'], 1);
    setTimeout(() => {
      names.push(['c', 'Corrugated Metal']);
      pending = false;
    }, 15);
    expect(await waiting).toBe('c');
  });

  it('TestR21_gives_up_with_no_sample_once_nothing_is_pending', async () => {
    expect(await findSampleProjectWhenImported(store([['a', 'My own']]), () => false, ['Corrugated-Metal'], 1)).toBeNull();
  });
});
