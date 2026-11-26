import type { Point } from '../model/geometry';

export type ToolId = 'paint' | 'selectBrush' | 'selectRect';

export type InteractionState =
  /** `hover`: the last pointer position seen while idle (the anchor of a Shift-move brush resize); absent until the pointer has moved over the stage. */
  | { s: 'idle'; spaceHeld: boolean; hover?: Point }
  | { s: 'dragging'; tool: ToolId; pointerId: number; last: Point }
  | { s: 'panning'; pointerId: number; last: Point };

/** Events that change the document or its settings; only `idle` lets them through (`passThrough`). */
export type DocumentEventName = 'undo' | 'redo' | 'invert' | 'fill' | 'crop' | 'setTool' | 'setColour' | 'setBrushSize' | 'apply' | 'cancel';

export type InteractionEvent =
  | { t: 'down'; button: number; pointerId: number; p: Point }
  | { t: 'move'; pointerId: number; p: Point; shift?: boolean }
  | { t: 'leave' }
  | { t: 'up'; pointerId: number }
  | { t: 'pointercancel'; pointerId: number }
  | { t: 'escape' }
  | { t: 'blur' }
  | { t: 'spaceDown' }
  | { t: 'spaceUp' }
  | { t: DocumentEventName };

export type InteractionEffect = 'none' | 'beginTool' | 'moveTool' | 'endTool' | 'cancelTool' | 'clearSelection' | 'pan' | 'resizeBrush' | 'passThrough';
export interface InteractionContext { tool: ToolId; hasSelection: boolean }
export interface InteractionStep { state: InteractionState; effect: InteractionEffect }

export const INITIAL_INTERACTION: InteractionState = { s: 'idle', spaceHeld: false };
const IDLE: InteractionState = INITIAL_INTERACTION;
const DOCUMENT_EVENTS: ReadonlySet<string> = new Set<DocumentEventName>(['undo', 'redo', 'invert', 'fill', 'crop', 'setTool', 'setColour', 'setBrushSize', 'apply', 'cancel']);

/** Pure transition table of the pointer interaction (contracts.md). Cells with no row leave the state unchanged and do nothing. */
export function stepInteraction(state: InteractionState, event: InteractionEvent, ctx: InteractionContext): InteractionStep {
  const stay: InteractionStep = { state, effect: 'none' };
  if (state.s === 'idle') {
    switch (event.t) {
      case 'down':
        if (event.button === 1 || (event.button === 0 && state.spaceHeld)) return { state: { s: 'panning', pointerId: event.pointerId, last: event.p }, effect: 'none' };
        if (event.button === 0) return { state: { s: 'dragging', tool: ctx.tool, pointerId: event.pointerId, last: event.p }, effect: 'beginTool' };
        return stay;
      case 'move': {
        const resize = event.shift === true && ctx.tool !== 'selectRect' && state.hover !== undefined;
        return { state: { ...state, hover: event.p }, effect: resize ? 'resizeBrush' : 'none' };
      }
      case 'leave': return { state: { s: 'idle', spaceHeld: state.spaceHeld }, effect: 'none' };
      case 'spaceDown': return { state: { ...state, spaceHeld: true }, effect: 'none' };
      case 'spaceUp': return { state: { ...state, spaceHeld: false }, effect: 'none' };
      case 'blur': return { state: IDLE, effect: 'none' };
      case 'escape': return { state, effect: ctx.tool !== 'paint' && ctx.hasSelection ? 'clearSelection' : 'none' };
      default: return DOCUMENT_EVENTS.has(event.t) ? { state, effect: 'passThrough' } : stay;
    }
  }
  if (state.s === 'dragging') {
    switch (event.t) {
      case 'move': return event.pointerId === state.pointerId ? { state: { ...state, last: event.p }, effect: 'moveTool' } : stay;
      case 'up': return event.pointerId === state.pointerId ? { state: IDLE, effect: 'endTool' } : stay;
      case 'pointercancel': return event.pointerId === state.pointerId ? { state: IDLE, effect: 'cancelTool' } : stay;
      case 'escape': case 'blur': return { state: IDLE, effect: 'cancelTool' };
      default: return stay;
    }
  }
  switch (event.t) {
    case 'move': return event.pointerId === state.pointerId ? { state: { ...state, last: event.p }, effect: 'pan' } : stay;
    case 'up': case 'pointercancel': return event.pointerId === state.pointerId ? { state: IDLE, effect: 'none' } : stay;
    case 'escape': case 'blur': return { state: IDLE, effect: 'none' };
    default: return stay;
  }
}
