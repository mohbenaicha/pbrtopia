// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import { createModifierTracker, createResizeAnchor, createWheelNotches, isEditableTarget, WHEEL_NOTCH } from '@mat/compositing/ui/brushGestures';

describe('brushGestures: modifiers (compositing R38, shared by Stamp and Clone)', () => {
  it('TestR38_remembers_alt_and_shift_from_any_event_and_clears_on_blur', () => {
    const tracker = createModifierTracker();
    tracker.remember({ altKey: true, shiftKey: false });
    expect(tracker.alt()).toBe(true);
    expect(tracker.shift()).toBe(false);
    tracker.remember({ altKey: true, shiftKey: true });
    expect(tracker.shift()).toBe(true);
    tracker.clear();
    expect(tracker.alt()).toBe(false);
    expect(tracker.shift()).toBe(false);
  });
});

describe('brushGestures: Alt-resize anchor (compositing R73)', () => {
  const alt = (clientX: number, extra: Partial<{ ctrlKey: boolean; shiftKey: boolean; buttons: number }> = {}) => ({ altKey: true, ctrlKey: false, shiftKey: false, buttons: 0, clientX, ...extra });

  it('TestR73_first_alt_move_only_anchors_then_reports_the_sideways_distance', () => {
    const anchor = createResizeAnchor();
    expect(anchor.move(alt(100), false)).toBeNull();
    expect(anchor.move(alt(130), false)).toBe(30);
    expect(anchor.move(alt(120), false)).toBe(-10);
  });

  it('TestR73_leaving_the_gesture_or_stroking_drops_the_anchor', () => {
    const anchor = createResizeAnchor();
    anchor.move(alt(100), false);
    expect(anchor.move(alt(150, { shiftKey: true }), false)).toBeNull();
    expect(anchor.move(alt(160), false)).toBeNull(); // anchored again, nothing to report yet
    expect(anchor.move(alt(170), true)).toBeNull(); // a stroke is open
    expect(anchor.move(alt(180), false)).toBeNull();
    anchor.reset();
    expect(anchor.move(alt(190), false)).toBeNull();
  });
});

describe('brushGestures: wheel notches (compositing R12)', () => {
  it('TestR12_a_notch_is_one_hundred_units_and_wheel_up_is_positive', () => {
    const wheel = createWheelNotches();
    expect(wheel.add(-WHEEL_NOTCH, 0)).toBe(1);
    expect(wheel.add(WHEEL_NOTCH * 2, 0)).toBe(-2);
  });

  it('TestR12_small_deltas_accumulate_and_a_reversal_restarts_the_count', () => {
    const wheel = createWheelNotches();
    expect(wheel.add(-60, 0)).toBe(0);
    expect(wheel.add(-60, 0)).toBe(1);
    expect(wheel.add(-60, 0)).toBe(0);
    expect(wheel.add(60, 0)).toBe(0); // the remainder of -20 is dropped on reversal
    expect(wheel.add(60, 0)).toBe(-1);
  });

  it('TestR12_line_mode_wheels_count_33_units_per_line_and_zero_does_nothing', () => {
    const wheel = createWheelNotches();
    expect(wheel.add(-3, 1)).toBe(0); // 99 units, short of a notch
    expect(wheel.add(-1, 1)).toBe(1);
    expect(wheel.add(0, 0)).toBe(0);
  });
});

describe('brushGestures: editable targets (compositing R19)', () => {
  it('TestR19_inputs_textareas_selects_and_contenteditable_are_editable', () => {
    expect(isEditableTarget(document.createElement('input'))).toBe(true);
    expect(isEditableTarget(document.createElement('textarea'))).toBe(true);
    expect(isEditableTarget(document.createElement('select'))).toBe(true);
    expect(isEditableTarget(document.createElement('div'))).toBe(false);
    expect(isEditableTarget(null)).toBe(false);
  });
});
