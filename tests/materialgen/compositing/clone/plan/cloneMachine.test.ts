import { describe, expect, it } from 'vitest';
import { blockedReason, enterEvent, flagsOf, INITIAL_CLONE_STATE, reduceClone, type CloneEvent, type CloneState } from '@mat/compositing/clone/plan/cloneMachine';

const run = (state: CloneState, ...events: CloneEvent[]): { state: CloneState; commands: string[] } => {
  let current = state;
  const commands: string[] = [];
  for (const event of events) {
    const next = reduceClone(current, event);
    current = next.state;
    commands.push(...next.commands);
  }
  return { state: current, commands };
};
const highlighted = (over: Partial<CloneState> = {}): CloneState => ({ ...INITIAL_CLONE_STATE, hasHighlight: true, liftable: 'ok', strength: 1, ...over });
const floating = (over: Partial<CloneState> = {}): CloneState => ({ ...highlighted(), phase: 'floating', moved: true, ...over });

describe('cloneMachine: Clone (clone R2, R6, R8)', () => {
  it('TestCloneR6_clone_does_nothing_without_a_liftable_highlight_and_says_why', () => {
    expect(run(INITIAL_CLONE_STATE, { type: 'clone' })).toEqual({ state: INITIAL_CLONE_STATE, commands: [] });
    expect(blockedReason(INITIAL_CLONE_STATE, 'clone')).toBe('empty');
    expect(run(highlighted({ liftable: 'too-large' }), { type: 'clone' }).commands).toEqual([]);
    expect(blockedReason(highlighted({ liftable: 'too-large' }), 'clone')).toBe('too-large');
    expect(blockedReason(highlighted(), 'clone')).toBeNull();
  });

  it('TestCloneR8_clone_lifts_the_copy_and_enters_floating_with_nothing_moved_yet', () => {
    const result = run(highlighted(), { type: 'clone' });
    expect(result.commands).toEqual(['capture']);
    expect(result.state).toMatchObject({ phase: 'floating', moved: false, hasHighlight: true });
    expect(flagsOf(result.state)).toMatchObject({ floating: true, canClone: false });
  });

  it('TestCloneR2_clone_waits_for_an_open_highlight_stroke_to_end', () => {
    expect(run(highlighted({ stroking: true }), { type: 'clone' }).commands).toEqual([]);
  });

  it('TestCloneR2_floating_ignores_highlight_strokes_and_a_second_clone', () => {
    expect(run(floating(), { type: 'strokeStarted' }).state.stroking).toBe(false);
    expect(run(floating(), { type: 'clone' }).commands).toEqual([]);
  });
});

describe('cloneMachine: Confirm (clone R12)', () => {
  it('TestCloneR12_confirm_bakes_once_and_returns_to_highlight_with_the_highlight_kept', () => {
    const result = run(floating(), { type: 'confirm' });
    expect(result.commands).toEqual(['bake']);
    expect(result.state).toMatchObject({ phase: 'highlight', hasHighlight: true, moved: false });
    expect(run(result.state, { type: 'confirm' }).commands).toEqual([]); // a double Enter writes nothing
  });

  it('TestCloneR12_confirm_is_blocked_while_the_copy_is_unmoved_and_while_strength_is_zero', () => {
    expect(run(floating({ moved: false }), { type: 'confirm' }).commands).toEqual([]);
    expect(blockedReason(floating({ moved: false }), 'confirm')).toBe('unmoved');
    expect(run(floating({ strength: 0 }), { type: 'confirm' }).commands).toEqual([]);
    expect(blockedReason(floating({ strength: 0 }), 'confirm')).toBe('no-strength');
    expect(blockedReason(floating(), 'confirm')).toBeNull();
    expect(flagsOf(floating()).canConfirm).toBe(true);
  });

  it('TestCloneR12_moving_the_copy_and_changing_strength_update_the_confirm_flag', () => {
    const state = run(floating({ moved: false, strength: 0 }), { type: 'placementChanged', moved: true }, { type: 'strengthChanged', strength: 0.5 });
    expect(flagsOf(state.state).canConfirm).toBe(true);
  });

  it('TestCloneR23_enter_confirms_while_floating_and_clones_otherwise', () => {
    expect(enterEvent(floating())).toEqual({ type: 'confirm' });
    expect(enterEvent(highlighted())).toEqual({ type: 'clone' });
  });
});

describe('cloneMachine: Esc (clone R13)', () => {
  it('TestCloneR13_esc_while_floating_discards_the_copy_and_keeps_the_highlight', () => {
    const result = run(floating(), { type: 'escape' });
    expect(result.commands).toEqual(['discard']);
    expect(result.state).toMatchObject({ phase: 'highlight', hasHighlight: true });
  });

  it('TestCloneR13_esc_in_highlight_ends_a_stroke_then_clears_the_marker_then_clears_the_highlight_one_step_each', () => {
    const state = highlighted({ stroking: true, marker: true });
    const first = run(state, { type: 'escape' });
    expect(first.commands).toEqual(['endStroke']);
    const second = run({ ...first.state, stroking: false }, { type: 'escape' });
    expect(second.commands).toEqual(['clearMarker']);
    expect(second.state.marker).toBe(false);
    const third = run(second.state, { type: 'escape' });
    expect(third.commands).toEqual(['clearHighlight']);
    expect(third.state).toMatchObject({ hasHighlight: false, liftable: 'empty' });
    expect(run(third.state, { type: 'escape' }).commands).toEqual([]);
  });

  it('TestCloneR13_there_is_no_cancel_after_confirm_so_esc_then_clears_the_highlight_not_the_placement', () => {
    const afterConfirm = run(floating(), { type: 'confirm' }).state;
    expect(run(afterConfirm, { type: 'escape' }).commands).toEqual(['clearHighlight']);
  });
});

describe('cloneMachine: leaving and tracking (clone R1, R4)', () => {
  it('TestCloneR1_leaving_the_mode_discards_a_floating_copy_and_clears_the_highlight', () => {
    expect(run(floating(), { type: 'modeLeft' })).toEqual({ state: INITIAL_CLONE_STATE, commands: ['discard', 'clearHighlight'] });
    expect(run(highlighted(), { type: 'modeLeft' }).commands).toEqual(['clearHighlight']);
    expect(run(INITIAL_CLONE_STATE, { type: 'modeLeft' }).commands).toEqual([]);
  });

  it('TestCloneR4_strokes_and_markers_and_the_highlight_summary_are_tracked', () => {
    let state = run(INITIAL_CLONE_STATE, { type: 'strokeStarted' }).state;
    expect(state.stroking).toBe(true);
    state = run(state, { type: 'highlightChanged', hasHighlight: true, liftable: 'ok' }, { type: 'strokeEnded' }, { type: 'markerSet' }).state;
    expect(state).toMatchObject({ stroking: false, hasHighlight: true, liftable: 'ok', marker: true });
    expect(flagsOf(state).canClone).toBe(true);
  });
});
