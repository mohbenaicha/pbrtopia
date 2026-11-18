import { describe, expect, it, vi } from 'vitest';
import type { TourStep } from '@shared/tutorial';
import { createMaterialTourStage } from '../../../src/materialgen/tutorial/materialTourStage';

function setup(options: { sampleId?: string | null; start?: string; registered?: () => boolean } = {}) {
  let hash = options.start ?? '#/projects';
  const goTo = vi.fn((next: string) => { hash = next; });
  const opened: string[] = [];
  const closed: string[] = [];
  const forgetOpenProject = vi.fn(async () => undefined);
  const stage = createMaterialTourStage({
    findSampleId: async () => (options.sampleId === undefined ? 's1' : options.sampleId),
    currentHash: () => hash,
    goTo,
    forgetOpenProject,
    openReveal: (id) => {
      if (options.registered !== undefined && !options.registered()) return false;
      opened.push(id);
      return true;
    },
    closeReveal: (id) => void closed.push(id),
    hasNeed: (need) => need === 'present',
    pollMs: 1,
    revealTimeoutMs: 40,
  });
  return { stage, goTo, opened, closed, forgetOpenProject, hash: () => hash };
}
const step = (stageName: string, reveal?: string[]): TourStep => ({ id: 'x', anchor: 'x', stage: stageName, ...(reveal === undefined ? {} : { reveal }) });
const signal = (): AbortSignal => new AbortController().signal;

describe('materialTourStage (tutorial R4)', () => {
  it('TestR4_a_project_step_goes_to_the_sample_project', async () => {
    const { stage, goTo } = setup();
    await stage.enter(step('project'), signal());
    expect(goTo).toHaveBeenCalledWith('#/p/s1');
  });

  it('TestR4_list_and_settings_steps_go_to_their_views_and_a_second_step_in_the_same_view_does_not_navigate_again', async () => {
    const { stage, goTo } = setup({ start: '#/p/mine' });
    await stage.enter(step('list'), signal());
    await stage.enter(step('list'), signal());
    await stage.enter(step('settings:models'), signal());
    expect(goTo.mock.calls.map((call) => call[0])).toEqual(['#/projects', '#/settings/models']);
  });

  it('TestR4_a_missing_sample_leaves_the_view_alone_and_does_not_throw', async () => {
    const { stage, goTo } = setup({ sampleId: null });
    await expect(stage.enter(step('project'), signal())).resolves.toBeUndefined();
    expect(goTo).not.toHaveBeenCalled();
  });

  it('TestR4_reveals_open_with_the_step_and_close_when_a_later_step_no_longer_names_them', async () => {
    const { stage, opened, closed } = setup({ start: '#/p/s1' });
    await stage.enter(step('project', ['viewport-settings']), signal());
    expect(opened).toEqual(['viewport-settings']);
    await stage.enter(step('project', ['viewport-settings']), signal());
    expect(opened).toEqual(['viewport-settings']);
    await stage.enter(step('project'), signal());
    expect(closed).toEqual(['viewport-settings']);
  });

  it('TestR4_a_reveal_whose_owner_mounts_late_is_opened_when_it_appears', async () => {
    let tries = 0;
    const { stage, opened } = setup({ start: '#/p/s1', registered: () => (tries += 1) > 3 });
    await stage.enter(step('project', ['export']), signal());
    expect(opened).toEqual(['export']);
  });

  it('TestR8_a_reveal_nobody_owns_gives_up_after_the_timeout_without_throwing', async () => {
    const { stage, opened } = setup({ start: '#/p/s1', registered: () => false });
    await expect(stage.enter(step('project', ['export']), signal())).resolves.toBeUndefined();
    expect(opened).toEqual([]);
  });

  it('TestR4_an_aborted_move_stops_waiting', async () => {
    const { stage } = setup({ start: '#/p/s1', registered: () => false });
    const controller = new AbortController();
    const entering = stage.enter(step('project', ['export']), controller.signal);
    controller.abort();
    await expect(entering).resolves.toBeUndefined();
  });

  it('TestR4_leave_closes_what_is_open_and_returns_to_where_the_tour_started', async () => {
    const { stage, closed, goTo, hash } = setup({ start: '#/p/mine' });
    await stage.enter(step('project', ['export']), signal());
    await stage.leave();
    expect(closed).toEqual(['export']);
    expect(goTo).toHaveBeenLastCalledWith('#/p/mine');
    expect(hash()).toBe('#/p/mine');
  });

  it('TestR4_leaving_for_the_project_list_forgets_the_open_project_the_tour_made_the_remembered_one', async () => {
    const { stage, forgetOpenProject, hash } = setup({ start: '#/projects' });
    await stage.enter(step('project'), signal());
    await stage.leave();
    expect(hash()).toBe('#/projects');
    expect(forgetOpenProject).toHaveBeenCalledTimes(1);
  });

  it('TestR4_a_tour_started_on_a_bare_address_returns_to_the_project_list', async () => {
    const { stage, hash } = setup({ start: '' });
    await stage.enter(step('project'), signal());
    await stage.leave();
    expect(hash()).toBe('#/projects');
  });

  it('TestR4_leave_before_any_step_changes_nothing', async () => {
    const { stage, goTo, forgetOpenProject } = setup();
    await stage.leave();
    expect(goTo).not.toHaveBeenCalled();
    expect(forgetOpenProject).not.toHaveBeenCalled();
  });

  it('TestR23_the_stage_says_what_the_host_has_and_a_host_that_does_not_say_has_everything', () => {
    const { stage } = setup();
    expect(stage.has?.('present')).toBe(true);
    expect(stage.has?.('absent')).toBe(false);
    const bare = createMaterialTourStage({ findSampleId: async () => null, currentHash: () => '', goTo: () => undefined, forgetOpenProject: async () => undefined, openReveal: () => true, closeReveal: () => undefined });
    expect(bare.has?.('anything')).toBe(true);
  });
});
