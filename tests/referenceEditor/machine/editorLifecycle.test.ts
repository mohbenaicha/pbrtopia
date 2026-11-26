import { describe, expect, it } from 'vitest';
import { stepLifecycle, type LifecycleEvent, type LifecycleState } from '../../../src/referenceEditor/machine/editorLifecycle';

const STATES: LifecycleState[] = ['closed', 'loading', 'ready', 'applying', 'failedOpen', 'closing'];
const EVENTS: LifecycleEvent[] = [{ t: 'open' }, { t: 'opened' }, { t: 'openFailed' }, { t: 'apply', pixelChanged: true }, { t: 'apply', pixelChanged: false }, { t: 'applied' }, { t: 'applyFailed' }, { t: 'cancel' }, { t: 'acknowledged' }, { t: 'closed' }];

describe('editor lifecycle machine (reference-editor R4, R15, R16)', () => {
  it('R4 closed -> loading on open; loading -> ready when decoded', () => {
    expect(stepLifecycle('closed', { t: 'open' }).state).toBe('loading');
    expect(stepLifecycle('loading', { t: 'opened' }).state).toBe('ready');
  });

  it('R4 a failed decode shows the message, then closes by itself once acknowledged', () => {
    const failed = stepLifecycle('loading', { t: 'openFailed' });
    expect(failed).toEqual({ state: 'failedOpen', effect: 'showOpenError' });
    expect(stepLifecycle('failedOpen', { t: 'acknowledged' }).state).toBe('closing');
    expect(stepLifecycle('failedOpen', { t: 'cancel' }).state).toBe('closing');
  });

  it('R15 Apply with a pixel change starts encoding; without one it closes straight away', () => {
    expect(stepLifecycle('ready', { t: 'apply', pixelChanged: true })).toEqual({ state: 'applying', effect: 'encode' });
    expect(stepLifecycle('ready', { t: 'apply', pixelChanged: false })).toEqual({ state: 'closing', effect: 'none' });
  });

  it('R15 a finished encode hands the picture over and closes', () => {
    expect(stepLifecycle('applying', { t: 'applied' })).toEqual({ state: 'closing', effect: 'emitApply' });
  });

  it('R16 an encode failure returns to ready with the message, history untouched', () => {
    expect(stepLifecycle('applying', { t: 'applyFailed' })).toEqual({ state: 'ready', effect: 'showApplyError' });
  });

  it('R15 Cancel works in every open state, and in applying it discards the result', () => {
    expect(stepLifecycle('ready', { t: 'cancel' }).state).toBe('closing');
    expect(stepLifecycle('loading', { t: 'cancel' }).state).toBe('closing');
    expect(stepLifecycle('applying', { t: 'cancel' })).toEqual({ state: 'closing', effect: 'discardResult' });
  });

  it('R15 a second Apply while applying is ignored', () => {
    expect(stepLifecycle('applying', { t: 'apply', pixelChanged: true })).toEqual({ state: 'applying', effect: 'none' });
  });

  it('R16 a late decode or encode result after the editor is closing is dropped', () => {
    for (const event of [{ t: 'opened' }, { t: 'openFailed' }, { t: 'applied' }, { t: 'applyFailed' }] as LifecycleEvent[]) expect(stepLifecycle('closing', event)).toEqual({ state: 'closing', effect: 'none' });
  });

  it('R4 closing -> closed on closed, which is when onClose is called', () => {
    expect(stepLifecycle('closing', { t: 'closed' })).toEqual({ state: 'closed', effect: 'callOnClose' });
  });

  it('R16 every (state, event) pair returns a known state and never throws', () => {
    for (const state of STATES) {
      for (const event of EVENTS) {
        const out = stepLifecycle(state, event);
        expect(STATES).toContain(out.state);
      }
    }
  });
});
