import { describe, expect, it } from 'vitest';
import { boundsOf, clampScale, copyRects, cornersOf, frameOf, isMoved, MAX_SCALE, MIN_SCALE, maxScaleOf, startPlacement, wrappedCopies, type Placement } from '@mat/compositing/clone/plan/placement';

const frame = { w: 0.2, h: 0.1 };
const at = (cx: number, cy: number, scale = 1, angle = 0): Placement => ({ cx, cy, scale, angle });
const near = (value: number, expected: number): void => expect(value).toBeCloseTo(expected, 6);

describe('placement (clone R9, R9a, R11)', () => {
  it('TestCloneR8_a_lifted_rect_starts_exactly_over_its_source_at_scale_one_without_turn', () => {
    const rect = { x: 100, y: 200, w: 200, h: 100 };
    expect(frameOf(rect, 1000)).toEqual({ w: 0.2, h: 0.1 });
    expect(startPlacement(rect, 1000)).toEqual({ cx: 0.2, cy: 0.25, scale: 1, angle: 0 });
  });

  it('TestCloneR9_corners_follow_the_centre_the_scale_and_the_turn_counter_clockwise_with_v_up', () => {
    const [bl, br, tr, tl] = cornersOf(frame, at(0.5, 0.5));
    near(bl.x, 0.4); near(bl.y, 0.45); near(br.x, 0.6); near(tr.y, 0.55); near(tl.x, 0.4);
    const quarter = cornersOf(frame, at(0.5, 0.5, 1, Math.PI / 2));
    near(quarter[0]!.x, 0.55); near(quarter[0]!.y, 0.4); // the bottom-left corner went round to the bottom-right
    const doubled = cornersOf(frame, at(0.5, 0.5, 2));
    near(doubled[2]!.x, 0.7); near(doubled[2]!.y, 0.6);
  });

  it('TestCloneR9_the_bounds_swap_their_sides_at_a_quarter_turn', () => {
    const box = boundsOf(frame, at(0.5, 0.5, 1, Math.PI / 2));
    near(box.x1 - box.x0, 0.1); near(box.y1 - box.y0, 0.2);
  });

  it('TestCloneR9a_the_scale_is_limited_to_a_quarter_and_to_what_keeps_the_half_diagonal_within_half_the_picture', () => {
    expect(MIN_SCALE).toBe(0.25);
    expect(MAX_SCALE).toBe(10);
    near(maxScaleOf(frame), 0.5 / (Math.hypot(0.2, 0.1) / 2));
    expect(maxScaleOf({ w: 0.01, h: 0.01 })).toBe(10);
    expect(clampScale(frame, 0.1)).toBe(0.25);
    expect(clampScale(frame, 100)).toBeCloseTo(maxScaleOf(frame), 9);
    expect(clampScale(frame, 2)).toBe(2);
  });

  it('TestCloneR9a_at_the_largest_scale_a_copy_at_any_turn_lands_within_one_picture_so_at_most_four_instances', () => {
    for (let angle = 0; angle < Math.PI; angle += 0.2) {
      const placement = at(0.3, 0.9, maxScaleOf(frame), angle);
      const box = boundsOf(frame, placement);
      expect(box.x1 - box.x0).toBeLessThanOrEqual(1 + 1e-9);
      expect(box.y1 - box.y0).toBeLessThanOrEqual(1 + 1e-9);
      expect(wrappedCopies(frame, placement).length).toBeLessThanOrEqual(4);
    }
  });

  it('TestCloneR11_a_copy_inside_the_picture_has_one_instance_and_one_near_an_edge_has_two_or_four', () => {
    expect(wrappedCopies(frame, at(0.5, 0.5))).toHaveLength(1);
    const edge = wrappedCopies(frame, at(0.05, 0.5));
    expect(edge).toHaveLength(2);
    expect(edge.map((copy) => Math.round(copy.cx * 100) / 100).sort()).toEqual([0.05, 1.05]);
    expect(wrappedCopies(frame, at(0.02, 0.02))).toHaveLength(4);
  });

  it('TestCloneR11_a_centre_dragged_beyond_the_picture_is_reduced_into_it', () => {
    expect(wrappedCopies(frame, at(1.5, -0.5))).toHaveLength(1);
    const [copy] = wrappedCopies(frame, at(1.5, -0.5));
    near(copy!.cx, 0.5); near(copy!.cy, 0.5);
  });

  it('TestCloneR16_a_corner_copy_has_four_small_rects_one_per_instance_never_a_picture_wide_union', () => {
    const rects = copyRects(frame, at(0.02, 0.02), 1000);
    expect(rects).toHaveLength(4);
    for (const rect of rects) {
      expect(rect.x0).toBeGreaterThanOrEqual(0);
      expect(rect.x1).toBeLessThanOrEqual(1000);
      expect(rect.x1 - rect.x0).toBeLessThan(250);
      expect(rect.y1 - rect.y0).toBeLessThan(150);
    }
  });

  it('TestCloneR16_an_interior_copy_has_one_rect_with_a_texel_of_margin', () => {
    const [rect] = copyRects(frame, at(0.5, 0.5), 1000);
    expect(rect).toEqual({ x0: 399, y0: 449, x1: 601, y1: 551 });
  });

  it('TestCloneR12_a_copy_back_where_it_was_lifted_is_not_moved_even_dragged_a_whole_picture_away', () => {
    const start = at(0.3, 0.4);
    expect(isMoved(start, start)).toBe(false);
    expect(isMoved(start, at(1.3, -0.6))).toBe(false);
    expect(isMoved(start, at(0.31, 0.4))).toBe(true);
    expect(isMoved(start, at(0.3, 0.4, 1.1))).toBe(true);
    expect(isMoved(start, at(0.3, 0.4, 1, 0.1))).toBe(true);
    expect(isMoved(start, at(0.3, 0.4, 1, 2 * Math.PI))).toBe(false);
  });
});
