import { describe, expect, it } from 'vitest';
import { INITIAL_INTERACTION, stepInteraction, type InteractionEvent, type InteractionState } from '../../../src/referenceEditor/machine/interaction';

const P = { x: 4, y: 5 };
const ctx = (tool: 'paint' | 'selectBrush' | 'selectRect', hasSelection: boolean) => ({ tool, hasSelection });
const down: InteractionEvent = { t: 'down', button: 0, pointerId: 1, p: P };
const dragging: InteractionState = { s: 'dragging', tool: 'paint', pointerId: 1, last: P };
const panning: InteractionState = { s: 'panning', pointerId: 1, last: P };

describe('interaction machine (reference-editor R10, R5)', () => {
  it('R10 idle + primary down starts the tool drag', () => {
    const out = stepInteraction(INITIAL_INTERACTION, down, ctx('paint', false));
    expect(out.state).toEqual({ s: 'dragging', tool: 'paint', pointerId: 1, last: P });
    expect(out.effect).toBe('beginTool');
  });

  it('R5 idle + middle button, or Space held + primary, starts a pan and never a tool drag', () => {
    expect(stepInteraction(INITIAL_INTERACTION, { t: 'down', button: 1, pointerId: 2, p: P }, ctx('paint', false)).state.s).toBe('panning');
    const held = stepInteraction(INITIAL_INTERACTION, { t: 'spaceDown' }, ctx('paint', false)).state;
    expect(held).toEqual({ s: 'idle', spaceHeld: true });
    const out = stepInteraction(held, down, ctx('paint', false));
    expect(out.state.s).toBe('panning');
    expect(out.effect).toBe('none');
  });

  const hovering = (tool: 'paint' | 'selectBrush' | 'selectRect' = 'paint'): InteractionState => stepInteraction(INITIAL_INTERACTION, { t: 'move', pointerId: 1, p: P }, ctx(tool, false)).state;

  it('R6 Shift + moving with a brush tool and no button down reports a resize; no click needed, the state stays idle', () => {
    const moveTo = (x: number, shift: boolean): InteractionEvent => ({ t: 'move', pointerId: 1, p: { x, y: 5 }, shift });
    for (const tool of ['paint', 'selectBrush'] as const) {
      const first = stepInteraction(hovering(tool), moveTo(10, false), ctx(tool, false));
      expect(first.effect).toBe('none');
      const out = stepInteraction(first.state, moveTo(30, true), ctx(tool, false));
      expect(out).toMatchObject({ state: { s: 'idle', hover: { x: 30, y: 5 } }, effect: 'resizeBrush' });
      expect(stepInteraction(out.state, moveTo(40, false), ctx(tool, false)).effect).toBe('none');
    }
  });

  it('R6 Shift-move does nothing for Rectangle select, without a known previous position, or after the pointer left', () => {
    const shiftMove: InteractionEvent = { t: 'move', pointerId: 1, p: { x: 30, y: 5 }, shift: true };
    expect(stepInteraction(hovering(), shiftMove, ctx('selectRect', false)).effect).toBe('none');
    expect(stepInteraction(INITIAL_INTERACTION, shiftMove, ctx('paint', false)).effect).toBe('none');
    expect(stepInteraction(stepInteraction(hovering(), { t: 'leave' }, ctx('paint', false)).state, shiftMove, ctx('paint', false)).effect).toBe('none');
  });

  it('R6 Shift during a drag or a pan changes nothing about them', () => {
    const shiftMove: InteractionEvent = { t: 'move', pointerId: 1, p: { x: 30, y: 5 }, shift: true };
    expect(stepInteraction(dragging, shiftMove, ctx('paint', false)).effect).toBe('moveTool');
    expect(stepInteraction(panning, shiftMove, ctx('paint', false)).effect).toBe('pan');
    expect(stepInteraction(INITIAL_INTERACTION, down, ctx('paint', false))).toMatchObject({ state: { s: 'dragging' }, effect: 'beginTool' });
    const held = stepInteraction(INITIAL_INTERACTION, { t: 'spaceDown' }, ctx('paint', false)).state;
    expect(stepInteraction(held, down, ctx('paint', false)).state.s).toBe('panning');
  });

  it('R10 dragging: move continues, up ends and commits, Esc cancels the drag with nothing kept', () => {
    expect(stepInteraction(dragging, { t: 'move', pointerId: 1, p: { x: 9, y: 9 } }, ctx('paint', false))).toMatchObject({ state: { s: 'dragging' }, effect: 'moveTool' });
    expect(stepInteraction(dragging, { t: 'up', pointerId: 1 }, ctx('paint', false))).toMatchObject({ state: { s: 'idle' }, effect: 'endTool' });
    expect(stepInteraction(dragging, { t: 'escape' }, ctx('selectBrush', true))).toMatchObject({ state: { s: 'idle' }, effect: 'cancelTool' });
  });

  it('R10 blur and pointercancel during a drag cancel it like Esc, and a lost Space is released', () => {
    expect(stepInteraction(dragging, { t: 'blur' }, ctx('paint', false)).effect).toBe('cancelTool');
    expect(stepInteraction(dragging, { t: 'pointercancel', pointerId: 1 }, ctx('paint', false)).effect).toBe('cancelTool');
    const held = stepInteraction(INITIAL_INTERACTION, { t: 'spaceDown' }, ctx('paint', false)).state;
    expect(stepInteraction(held, { t: 'blur' }, ctx('paint', false)).state).toEqual({ s: 'idle', spaceHeld: false });
  });

  it('R10 a second pointer or a second button during a drag is ignored', () => {
    expect(stepInteraction(dragging, { t: 'down', button: 0, pointerId: 2, p: P }, ctx('paint', false))).toEqual({ state: dragging, effect: 'none' });
    expect(stepInteraction(dragging, { t: 'move', pointerId: 2, p: P }, ctx('paint', false))).toEqual({ state: dragging, effect: 'none' });
    expect(stepInteraction(dragging, { t: 'up', pointerId: 2 }, ctx('paint', false))).toEqual({ state: dragging, effect: 'none' });
  });

  it('R10 idle + Esc clears the selection only with a select tool and a selection', () => {
    expect(stepInteraction(INITIAL_INTERACTION, { t: 'escape' }, ctx('selectBrush', true)).effect).toBe('clearSelection');
    expect(stepInteraction(INITIAL_INTERACTION, { t: 'escape' }, ctx('selectRect', true)).effect).toBe('clearSelection');
    expect(stepInteraction(INITIAL_INTERACTION, { t: 'escape' }, ctx('selectBrush', false)).effect).toBe('none');
    expect(stepInteraction(INITIAL_INTERACTION, { t: 'escape' }, ctx('paint', true)).effect).toBe('none');
  });

  it('R10 while dragging every document or settings event is ignored', () => {
    for (const t of ['undo', 'redo', 'invert', 'fill', 'crop', 'setTool', 'setColour', 'setBrushSize', 'apply', 'cancel'] as const) {
      expect(stepInteraction(dragging, { t }, ctx('paint', true))).toEqual({ state: dragging, effect: 'none' });
    }
  });

  it('R5 panning: move pans, up and Esc and blur end it, other events are ignored', () => {
    expect(stepInteraction(panning, { t: 'move', pointerId: 1, p: P }, ctx('paint', false)).effect).toBe('pan');
    for (const event of [{ t: 'up', pointerId: 1 }, { t: 'escape' }, { t: 'blur' }] as InteractionEvent[]) expect(stepInteraction(panning, event, ctx('paint', false)).state).toEqual({ s: 'idle', spaceHeld: false });
    expect(stepInteraction(panning, down, ctx('paint', false)).state).toEqual(panning);
  });

  it('R10 events with no row in the table never throw and leave the state unchanged', () => {
    const states: InteractionState[] = [INITIAL_INTERACTION, dragging, panning];
    const events: InteractionEvent[] = [{ t: 'up', pointerId: 9 }, { t: 'move', pointerId: 9, p: P }, { t: 'spaceUp' }, { t: 'undo' }];
    for (const state of states) for (const event of events) expect(() => stepInteraction(state, event, ctx('paint', false))).not.toThrow();
  });
});
