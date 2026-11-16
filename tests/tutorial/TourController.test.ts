// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { TourController } from '../../src/tutorial/TourController';
import type { TourSection, TourStage, TourStep } from '../../src/tutorial/tourTypes';

const SECTIONS: TourSection[] = [
  { id: 'a', title: 'Alpha', steps: [{ id: 'a.one', anchor: 'one' }, { id: 'a.two', anchor: 'two', stage: 'list' }] },
  { id: 'b', title: 'Beta', steps: [{ id: 'b.one', anchor: 'three', reveal: ['popover'] }] },
];
const TEXTS = {
  'a.one': { heading: 'One', paragraphs: ['first'] },
  'a.two': { heading: 'Two', paragraphs: ['second'] },
  'b.one': { heading: 'Three', paragraphs: ['third'] },
};

interface Gate { release: () => void }

function fakeStage(options: { hold?: boolean } = {}) {
  const calls: string[] = [];
  const gates: Gate[] = [];
  const stage: TourStage = {
    async enter(step: TourStep, signal: AbortSignal) {
      calls.push(`enter ${step.id}`);
      if (options.hold) await new Promise<void>((resolve) => { gates.push({ release: resolve }); signal.addEventListener('abort', () => resolve()); });
    },
    async leave() {
      calls.push('leave');
    },
  };
  return { stage, calls, gates };
}

const found = (): Element => document.createElement('div');
const settle = (): Promise<void> => new Promise((resolve) => setTimeout(resolve, 0));

function make(stage: TourStage, findAnchor: (id: string) => Promise<Element | null> = async () => ({}) as Element) {
  return new TourController({ sections: SECTIONS, stage, texts: TEXTS, findAnchor });
}

describe('TourController (tutorial R3, R4, R8, R11)', () => {
  it('TestR3_start_shows_the_first_step_after_the_stage_entered_it', async () => {
    const { stage, calls } = fakeStage();
    const tour = make(stage);
    tour.start();
    expect(tour.snapshot()).toMatchObject({ active: true, index: 0, total: 3, phase: 'moving' });
    await settle();
    expect(calls).toEqual(['enter a.one']);
    expect(tour.snapshot()).toMatchObject({ phase: 'showing', heading: 'One', paragraphs: ['first'], sectionTitle: 'Alpha' });
  });

  it('TestR3_next_and_previous_walk_the_steps_across_sections_and_stop_at_the_first', async () => {
    const { stage } = fakeStage();
    const tour = make(stage);
    tour.start();
    await settle();
    tour.previous();
    expect(tour.snapshot().index).toBe(0);
    tour.next();
    await settle();
    tour.next();
    await settle();
    expect(tour.snapshot()).toMatchObject({ index: 2, heading: 'Three', sectionTitle: 'Beta' });
    tour.previous();
    await settle();
    expect(tour.snapshot().index).toBe(1);
  });

  it('TestR11_start_can_begin_at_a_section', async () => {
    const { stage, calls } = fakeStage();
    const tour = make(stage);
    tour.start({ sectionId: 'b' });
    await settle();
    expect(calls).toEqual(['enter b.one']);
    expect(tour.snapshot().index).toBe(2);
  });

  it('TestR4_the_last_next_leaves_once_and_ends_the_tour', async () => {
    const { stage, calls } = fakeStage();
    const tour = make(stage);
    tour.start({ sectionId: 'b' });
    await settle();
    tour.next();
    await settle();
    expect(tour.snapshot().active).toBe(false);
    expect(calls.filter((call) => call === 'leave')).toHaveLength(1);
  });

  it('TestR4_exit_leaves_once_even_when_called_twice', async () => {
    const { stage, calls } = fakeStage();
    const tour = make(stage);
    tour.start();
    await settle();
    tour.exit();
    tour.exit();
    await settle();
    expect(tour.snapshot().active).toBe(false);
    expect(calls.filter((call) => call === 'leave')).toHaveLength(1);
  });

  it('TestR4_fast_clicks_abort_the_older_move_and_only_the_last_step_shows', async () => {
    const { stage, gates } = fakeStage({ hold: true });
    const tour = make(stage);
    tour.start();
    await settle();
    gates[0]?.release();
    await settle();
    tour.next();
    tour.next();
    await settle();
    gates.slice(1).forEach((gate) => gate.release());
    await settle();
    expect(tour.snapshot()).toMatchObject({ index: 2, phase: 'showing', heading: 'Three' });
  });

  it('TestR8_a_target_that_is_not_found_shows_the_step_without_a_target_and_the_tour_goes_on', async () => {
    const { stage } = fakeStage();
    const tour = make(stage, async () => null);
    tour.start();
    await settle();
    expect(tour.snapshot()).toMatchObject({ phase: 'showing', target: null, heading: 'One' });
    tour.next();
    await settle();
    expect(tour.snapshot().index).toBe(1);
  });

  it('TestR8_a_stage_that_throws_does_not_break_the_tour', async () => {
    const stage: TourStage = { enter: async () => { throw new Error('boom'); }, leave: async () => undefined };
    const tour = make(stage);
    tour.start();
    await settle();
    expect(tour.snapshot()).toMatchObject({ active: true, phase: 'showing', target: null });
  });

  it('TestR1_starting_while_it_runs_restarts_at_the_first_step', async () => {
    const { stage } = fakeStage();
    const tour = make(stage);
    tour.start({ sectionId: 'b' });
    await settle();
    tour.start();
    await settle();
    expect(tour.snapshot()).toMatchObject({ index: 0, active: true });
  });

  it('TestR3_the_target_is_the_element_the_anchor_lookup_found', async () => {
    const { stage } = fakeStage();
    const element = found();
    const tour = make(stage, async () => element);
    tour.start();
    await settle();
    expect(tour.snapshot().target).toBe(element);
  });

  it('TestR3_subscribers_are_told_about_changes_and_can_unsubscribe', async () => {
    const { stage } = fakeStage();
    const tour = make(stage);
    let told = 0;
    const stop = tour.subscribe(() => (told += 1));
    tour.start();
    await settle();
    expect(told).toBeGreaterThan(0);
    stop();
    const before = told;
    tour.next();
    await settle();
    expect(told).toBe(before);
  });
});
