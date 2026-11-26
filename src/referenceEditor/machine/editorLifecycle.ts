export type LifecycleState = 'closed' | 'loading' | 'ready' | 'applying' | 'failedOpen' | 'closing';

export type LifecycleEvent =
  | { t: 'open' }
  | { t: 'opened' }
  | { t: 'openFailed' }
  | { t: 'apply'; pixelChanged: boolean }
  | { t: 'applied' }
  | { t: 'applyFailed' }
  | { t: 'cancel' }
  | { t: 'acknowledged' }
  | { t: 'closed' };

export type LifecycleEffect = 'none' | 'decode' | 'showOpenError' | 'encode' | 'emitApply' | 'showApplyError' | 'discardResult' | 'callOnClose';
export interface LifecycleStep { state: LifecycleState; effect: LifecycleEffect }

/** Pure transition table of the editor (contracts.md). A result arriving in a state that no longer waits for it is dropped. */
export function stepLifecycle(state: LifecycleState, event: LifecycleEvent): LifecycleStep {
  const stay: LifecycleStep = { state, effect: 'none' };
  switch (state) {
    case 'closed': return event.t === 'open' ? { state: 'loading', effect: 'decode' } : stay;
    case 'loading':
      if (event.t === 'opened') return { state: 'ready', effect: 'none' };
      if (event.t === 'openFailed') return { state: 'failedOpen', effect: 'showOpenError' };
      return event.t === 'cancel' ? { state: 'closing', effect: 'none' } : stay;
    case 'ready':
      if (event.t === 'apply') return event.pixelChanged ? { state: 'applying', effect: 'encode' } : { state: 'closing', effect: 'none' };
      return event.t === 'cancel' ? { state: 'closing', effect: 'none' } : stay;
    case 'applying':
      if (event.t === 'applied') return { state: 'closing', effect: 'emitApply' };
      if (event.t === 'applyFailed') return { state: 'ready', effect: 'showApplyError' };
      return event.t === 'cancel' ? { state: 'closing', effect: 'discardResult' } : stay;
    case 'failedOpen': return event.t === 'acknowledged' || event.t === 'cancel' ? { state: 'closing', effect: 'none' } : stay;
    case 'closing': return event.t === 'closed' ? { state: 'closed', effect: 'callOnClose' } : stay;
  }
}
