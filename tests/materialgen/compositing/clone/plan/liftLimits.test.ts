import { describe, expect, it } from 'vitest';
import { fadeRadiusTexels, FADE_RADIUS_CAP, LAYER_BUDGET_BYTES, LAYER_BYTES_PER_TEXEL, liftability } from '@mat/compositing/clone/plan/liftLimits';

describe('fadeRadiusTexels (clone R10)', () => {
  it('TestCloneR10_hardness_one_keeps_the_edge_as_painted', () => {
    expect(fadeRadiusTexels(1, 0.2, 1000)).toBe(0);
  });

  it('TestCloneR10_the_radius_is_a_quarter_of_the_brush_size_at_hardness_zero', () => {
    expect(fadeRadiusTexels(0, 0.1, 1000)).toBe(25);
    expect(fadeRadiusTexels(0.5, 0.1, 1000)).toBe(13);
  });

  it('TestCloneR10_the_radius_never_exceeds_the_cap', () => {
    expect(fadeRadiusTexels(0, 1, 4096)).toBe(FADE_RADIUS_CAP);
    expect(FADE_RADIUS_CAP).toBe(64);
  });
});

describe('liftability (clone R6, R20)', () => {
  const side = 1024;

  it('TestCloneR6_an_empty_highlight_cannot_be_lifted', () => {
    expect(liftability(null, side)).toBe('empty');
  });

  it('TestCloneR6_a_rect_within_the_picture_diagonal_and_the_layer_budget_can_be_lifted', () => {
    expect(liftability({ x: 0, y: 0, w: 300, h: 300 }, side)).toBe('ok');
  });

  it('TestCloneR6_a_diagonal_longer_than_the_picture_side_is_too_large_so_the_copy_could_not_land_in_one_picture_width', () => {
    expect(liftability({ x: 0, y: 0, w: side, h: 300 }, side)).toBe('too-large');
    expect(liftability({ x: 0, y: 0, w: 724, h: 724 }, side)).toBe('ok'); // diagonal 1023.9
    expect(liftability({ x: 0, y: 0, w: 730, h: 730 }, side)).toBe('too-large'); // diagonal 1032
  });

  it('TestCloneR20_a_rect_over_the_layer_budget_is_too_large_at_14_bytes_a_texel', () => {
    expect(LAYER_BYTES_PER_TEXEL).toBe(14);
    expect(LAYER_BUDGET_BYTES).toBe(96 * 1024 * 1024);
    const side4096 = 4096;
    expect(liftability({ x: 0, y: 0, w: 2600, h: 2600 }, side4096)).toBe('ok'); // 6.76 Mtexel x 14 B = 90 MiB, and the diagonal (3677) is inside the side
    expect(liftability({ x: 0, y: 0, w: 2800, h: 2800 }, side4096)).toBe('too-large'); // 7.84 Mtexel x 14 B = 105 MiB is over the budget, the diagonal (3960) is not
  });
});
