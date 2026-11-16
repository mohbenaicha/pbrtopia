import { describe, expect, it } from 'vitest';
import { beginDrag, dragTo, hitHandle, HANDLE_RADIUS, scaleByPointer, turnByWheel, type HandleLayout } from '@mat/compositing/clone/plan/dragPlacement';
import { maxScaleOf, type Placement } from '@mat/compositing/clone/plan/placement';

const frame = { w: 0.2, h: 0.1 };
const start: Placement = { cx: 0.5, cy: 0.5, scale: 1, angle: 0 };
const near = (value: number, expected: number, digits = 6): void => expect(value).toBeCloseTo(expected, digits);

// A 200 x 100 pixel copy centred at (400, 300) with the rotation handle 30 px above its top edge.
const layout: HandleLayout = { corners: [{ x: 300, y: 350 }, { x: 500, y: 350 }, { x: 500, y: 250 }, { x: 300, y: 250 }], rotate: { x: 400, y: 220 } };

describe('hitHandle (clone R9, R23: screen-space hits)', () => {
  it('TestCloneR23_handles_are_hit_within_fourteen_screen_pixels', () => {
    expect(HANDLE_RADIUS).toBe(14);
    expect(hitHandle(layout, { x: 405, y: 226 })).toEqual({ kind: 'rotate' });
    expect(hitHandle(layout, { x: 508, y: 244 })).toEqual({ kind: 'corner', index: 2 });
    expect(hitHandle(layout, { x: 292, y: 358 })).toEqual({ kind: 'corner', index: 0 });
  });

  it('TestCloneR9_a_press_inside_the_copy_grabs_its_body_and_one_outside_grabs_nothing', () => {
    expect(hitHandle(layout, { x: 400, y: 300 })).toEqual({ kind: 'body' });
    expect(hitHandle(layout, { x: 600, y: 300 })).toBeNull();
    expect(hitHandle(layout, { x: 400, y: 190 })).toBeNull(); // beyond the rotation handle's radius
  });

  it('TestCloneR9_a_handle_wins_over_the_body_where_they_overlap', () => {
    expect(hitHandle(layout, { x: 308, y: 342 })).toEqual({ kind: 'corner', index: 0 });
  });

  it('TestCloneR23_the_hit_works_for_a_mirrored_screen_orientation_too', () => {
    const mirrored: HandleLayout = { corners: [layout.corners[1]!, layout.corners[0]!, layout.corners[3]!, layout.corners[2]!], rotate: layout.rotate };
    expect(hitHandle(mirrored, { x: 400, y: 300 })).toEqual({ kind: 'body' });
  });
});

describe('dragPlacement (clone R9, R11)', () => {
  it('TestCloneR9_dragging_the_body_moves_the_centre_by_the_pointer_travel', () => {
    const drag = beginDrag({ kind: 'body' }, { x: 0.5, y: 0.5 }, start);
    const moved = dragTo(drag, { x: 0.62, y: 0.41 }, frame);
    near(moved.cx, 0.62); near(moved.cy, 0.41);
    expect(moved.scale).toBe(1);
    expect(moved.angle).toBe(0);
  });

  it('TestCloneR11_a_drag_across_the_picture_edge_goes_on_in_unwrapped_space_so_the_copy_wraps_instead_of_jumping_back', () => {
    const drag = beginDrag({ kind: 'body' }, { x: 0.9, y: 0.5 }, { ...start, cx: 0.9 });
    dragTo(drag, { x: 0.97, y: 0.5 }, frame);
    const across = dragTo(drag, { x: 0.04, y: 0.5 }, frame); // the pointer's picture point wrapped
    near(across.cx, 1.04);
    const further = dragTo(drag, { x: 0.3, y: 0.5 }, frame);
    near(further.cx, 1.3);
  });

  it('TestCloneR9_dragging_a_corner_scales_about_the_centre_by_the_ratio_of_the_distances', () => {
    const drag = beginDrag({ kind: 'corner', index: 2 }, { x: 0.6, y: 0.55 }, start);
    const grown = dragTo(drag, { x: 0.7, y: 0.6 }, frame);
    near(grown.scale, 2);
    expect([grown.cx, grown.cy]).toEqual([0.5, 0.5]);
  });

  it('TestCloneR9a_the_scale_never_leaves_its_limits', () => {
    const drag = beginDrag({ kind: 'corner', index: 2 }, { x: 0.6, y: 0.55 }, start);
    expect(dragTo(drag, { x: 0.5001, y: 0.5001 }, frame).scale).toBe(0.25);
    expect(dragTo(drag, { x: 5, y: 5 }, frame).scale).toBeCloseTo(maxScaleOf(frame), 9);
  });

  it('TestCloneR9_dragging_the_rotation_handle_turns_the_copy_by_the_angle_the_pointer_swept', () => {
    const drag = beginDrag({ kind: 'rotate' }, { x: 0.5, y: 0.7 }, start);
    const turned = dragTo(drag, { x: 0.3, y: 0.5 }, frame); // from straight up to straight left: a quarter turn counter-clockwise
    near(turned.angle, Math.PI / 2);
    expect([turned.cx, turned.cy, turned.scale]).toEqual([0.5, 0.5, 1]);
  });

  it('TestCloneR9_the_wheel_turns_five_degrees_a_notch_and_one_with_shift', () => {
    near(turnByWheel(start, 2, false).angle, (10 * Math.PI) / 180);
    near(turnByWheel(start, -3, true).angle, (-3 * Math.PI) / 180);
    expect(turnByWheel(start, 0, false)).toEqual(start);
  });
});

describe('scaleByPointer (clone R24: Alt + sideways movement scales the floating copy)', () => {
  it('TestCloneR24_six_hundred_pixels_right_multiplies_the_scale_by_e_and_left_divides_it', () => {
    near(scaleByPointer(start, frame, 600).scale, Math.E);
    near(scaleByPointer(start, frame, -600).scale, 1 / Math.E);
    expect([scaleByPointer(start, frame, 30).cx, scaleByPointer(start, frame, 30).angle]).toEqual([0.5, 0]);
  });

  it('TestCloneR24_the_scale_is_clamped_like_the_handles_and_a_zero_move_returns_the_same_placement', () => {
    expect(scaleByPointer(start, frame, 1e6).scale).toBe(maxScaleOf(frame));
    expect(scaleByPointer(start, frame, -1e6).scale).toBe(0.25);
    expect(scaleByPointer(start, frame, 0)).toBe(start);
  });
});
