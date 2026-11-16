import { describe, expect, it } from 'vitest';
import { createHighlightBounds, liftRect } from '@mat/compositing/clone/plan/highlightBounds';

const stampAt = (x: number, y: number, size = 0.1) => ({ x, y, size });

describe('highlightBounds (clone R8a, R6)', () => {
  it('TestCloneR6_a_new_highlight_is_empty_and_has_no_box', () => {
    const bounds = createHighlightBounds();
    expect(bounds.isEmpty()).toBe(true);
    expect(bounds.box()).toBeNull();
  });

  it('TestCloneR8a_one_stamp_gives_a_box_of_its_own_size_centred_on_it', () => {
    const bounds = createHighlightBounds();
    bounds.add(stampAt(0.5, 0.4, 0.2));
    expect(bounds.isEmpty()).toBe(false);
    const box = bounds.box()!;
    expect([box.x0, box.y0, box.x1, box.y1].map((value) => Math.round(value * 1000) / 1000)).toEqual([0.4, 0.3, 0.6, 0.5]);
  });

  it('TestCloneR8a_the_box_grows_to_cover_every_stamp_and_reset_empties_it', () => {
    const bounds = createHighlightBounds();
    bounds.add(stampAt(0.3, 0.3));
    bounds.add(stampAt(0.5, 0.2));
    const box = bounds.box()!;
    expect(box.x0).toBeCloseTo(0.25);
    expect(box.x1).toBeCloseTo(0.55);
    expect(box.y0).toBeCloseTo(0.15);
    expect(box.y1).toBeCloseTo(0.35);
    bounds.reset();
    expect(bounds.isEmpty()).toBe(true);
  });

  it('TestCloneR8a_a_stroke_crossing_the_seam_is_one_small_box_in_unwrapped_uv_not_a_picture_wide_one', () => {
    const bounds = createHighlightBounds();
    bounds.add(stampAt(0.95, 0.5));
    bounds.add(stampAt(0.02, 0.5)); // the pointer wrapped: 0.02 is 1.02 unwrapped, next to 0.95
    const box = bounds.box()!;
    expect(box.x0).toBeCloseTo(0.9);
    expect(box.x1).toBeCloseTo(1.07);
  });

  it('TestCloneR8a_two_islands_either_side_of_a_seam_are_joined_through_the_nearer_side', () => {
    const bounds = createHighlightBounds();
    bounds.add(stampAt(0.97, 0.2));
    bounds.add(stampAt(0.03, 0.8)); // a later, separate stroke
    const box = bounds.box()!;
    expect(box.x1 - box.x0).toBeLessThan(0.3);
  });

  it('TestCloneR8a_an_axis_whose_span_reaches_the_whole_picture_becomes_the_whole_picture', () => {
    const bounds = createHighlightBounds();
    for (let x = 0.05; x <= 1.0001; x += 0.05) bounds.add(stampAt(x % 1, 0.5, 0.1));
    const box = bounds.box()!;
    expect([box.x0, box.x1]).toEqual([0, 1]);
    expect(box.y1 - box.y0).toBeLessThan(0.2);
  });
});

describe('liftRect (clone R8a: padded, clamped to the picture)', () => {
  const side = 1000;

  it('TestCloneR8a_the_lifted_area_is_the_box_padded_by_the_fade_band_plus_one_texel', () => {
    const rect = liftRect({ x0: 0.4, y0: 0.3, x1: 0.6, y1: 0.5 }, side, 10);
    expect(rect).toEqual({ x: 389, y: 289, w: 222, h: 222 });
  });

  it('TestCloneR8a_the_origin_may_be_unwrapped_outside_the_picture_so_a_seam_crossing_copy_stays_in_one_piece', () => {
    const rect = liftRect({ x0: 0.9, y0: 0.4, x1: 1.07, y1: 0.5 }, side, 0);
    expect(rect.x).toBe(899);
    expect(rect.w).toBe(172);
  });

  it('TestCloneR8a_a_padded_axis_that_reaches_the_picture_becomes_the_whole_axis', () => {
    expect(liftRect({ x0: 0.02, y0: 0.4, x1: 0.99, y1: 0.5 }, side, 20)).toMatchObject({ x: 0, w: side });
    expect(liftRect({ x0: 0, y0: 0.4, x1: 1, y1: 0.5 }, side, 0)).toMatchObject({ x: 0, w: side });
  });
});
