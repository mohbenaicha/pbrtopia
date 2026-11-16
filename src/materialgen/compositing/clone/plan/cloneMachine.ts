import type { Liftability } from './liftLimits';

/** Clone R2: Highlight (painting what to copy) or Floating (a lifted copy exists). */
export type ClonePhase = 'highlight' | 'floating';

export interface CloneState {
  phase: ClonePhase;
  hasHighlight: boolean;
  /** Whether the highlight can be lifted now (clone R6); the controller recomputes it when the highlight, Size or Hardness changes. */
  liftable: Liftability;
  /** A highlight stroke is open. */
  stroking: boolean;
  /** The line marker is set. */
  marker: boolean;
  /** The floating copy differs from where it was lifted (clone R12). */
  moved: boolean;
  strength: number;
}

export const INITIAL_CLONE_STATE: CloneState = { phase: 'highlight', hasHighlight: false, liftable: 'empty', stroking: false, marker: false, moved: false, strength: 1 };

export type CloneEvent =
  | { type: 'strokeStarted' }
  | { type: 'strokeEnded' }
  | { type: 'highlightChanged'; hasHighlight: boolean; liftable: Liftability }
  | { type: 'markerSet' }
  | { type: 'markerCleared' }
  | { type: 'strengthChanged'; strength: number }
  | { type: 'placementChanged'; moved: boolean }
  | { type: 'clone' }
  | { type: 'confirm' }
  | { type: 'escape' }
  | { type: 'modeLeft' };

/** What the controller must do for the transition: it holds no rules of its own. */
export type CloneCommand = 'capture' | 'bake' | 'discard' | 'clearHighlight' | 'clearMarker' | 'endStroke';

export interface CloneFlags { floating: boolean; canClone: boolean; canConfirm: boolean }

export function flagsOf(state: CloneState): CloneFlags {
  return {
    floating: state.phase === 'floating',
    canClone: state.phase === 'highlight' && state.hasHighlight && state.liftable === 'ok' && !state.stroking,
    canConfirm: state.phase === 'floating' && state.moved && state.strength > 0,
  };
}

/** Why a button is disabled, for its tooltip (clone R6, R12); null when it is enabled. */
export function blockedReason(state: CloneState, button: 'clone' | 'confirm'): 'empty' | 'too-large' | 'unmoved' | 'no-strength' | null {
  const flags = flagsOf(state);
  if (button === 'clone') {
    if (flags.canClone || state.phase === 'floating') return null;
    return state.liftable === 'too-large' ? 'too-large' : 'empty';
  }
  if (flags.canConfirm || state.phase === 'highlight') return null;
  return state.strength <= 0 ? 'no-strength' : 'unmoved';
}

/** The event Enter stands for: Confirm while a copy floats, Clone otherwise (clone R8, R12). */
export const enterEvent = (state: CloneState): CloneEvent => (state.phase === 'floating' ? { type: 'confirm' } : { type: 'clone' });

interface Step { state: CloneState; commands: CloneCommand[] }
const stay = (state: CloneState): Step => ({ state, commands: [] });

/** Clone R2, R6, R12, R13: the Highlight/Floating rules as a reducer, so the controller only translates input to events and runs commands. */
export function reduceClone(state: CloneState, event: CloneEvent): Step {
  switch (event.type) {
    case 'strokeStarted': return state.phase === 'highlight' ? stay({ ...state, stroking: true }) : stay(state);
    case 'strokeEnded': return stay({ ...state, stroking: false });
    case 'highlightChanged': return stay({ ...state, hasHighlight: event.hasHighlight, liftable: event.liftable });
    case 'markerSet': return stay({ ...state, marker: true });
    case 'markerCleared': return stay({ ...state, marker: false });
    case 'strengthChanged': return stay({ ...state, strength: event.strength });
    case 'placementChanged': return state.phase === 'floating' ? stay({ ...state, moved: event.moved }) : stay(state);
    case 'clone': return flagsOf(state).canClone ? { state: { ...state, phase: 'floating', moved: false }, commands: ['capture'] } : stay(state);
    case 'confirm': return flagsOf(state).canConfirm ? { state: { ...state, phase: 'highlight', moved: false }, commands: ['bake'] } : stay(state);
    case 'escape':
      if (state.phase === 'floating') return { state: { ...state, phase: 'highlight', moved: false }, commands: ['discard'] };
      if (state.stroking) return { state, commands: ['endStroke'] };
      if (state.marker) return { state: { ...state, marker: false }, commands: ['clearMarker'] };
      if (state.hasHighlight) return { state: { ...state, hasHighlight: false, liftable: 'empty' }, commands: ['clearHighlight'] };
      return stay(state);
    case 'modeLeft': {
      const commands: CloneCommand[] = [];
      if (state.phase === 'floating') commands.push('discard');
      if (state.hasHighlight) commands.push('clearHighlight');
      return { state: { ...INITIAL_CLONE_STATE, strength: state.strength }, commands };
    }
  }
}
