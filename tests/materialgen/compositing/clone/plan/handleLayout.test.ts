import { describe, expect, it } from 'vitest';
import { layoutHandles, ROTATE_HANDLE_OFFSET } from '@mat/compositing/clone/plan/handleLayout';

// a flat view: the picture's unit square is 1000 pixels wide, picture y up is screen y down
const flat = (point: { x: number; y: number }) => ({ x: point.x * 1000, y: (1 - point.y) * 1000 });
const FRAME = { w: 0.2, h: 0.1 };

describe('layoutHandles (clone R9, R23)', () => {
  it('TestCloneR9_the_corners_follow_the_projection_in_cornersOf_order', () => {
    const layout = layoutHandles(FRAME, { cx: 0.5, cy: 0.5, scale: 1, angle: 0 }, flat)!;
    expect(layout.corners[0].x).toBeCloseTo(400, 6); // bottom-left of the picture-space copy
    expect(layout.corners[0].y).toBeCloseTo(550, 6);
    expect(layout.corners[2].x).toBeCloseTo(600, 6); // top-right
    expect(layout.corners[2].y).toBeCloseTo(450, 6);
  });

  it('TestCloneR9_the_rotation_handle_stands_a_fixed_number_of_pixels_beyond_the_middle_of_the_top_edge', () => {
    const layout = layoutHandles(FRAME, { cx: 0.5, cy: 0.5, scale: 1, angle: 0 }, flat)!;
    expect(layout.rotate.x).toBeCloseTo(500, 6);
    expect(layout.rotate.y).toBeCloseTo(450 - ROTATE_HANDLE_OFFSET, 6);
  });

  it('TestCloneR9_the_rotation_handle_turns_with_the_copy', () => {
    const layout = layoutHandles(FRAME, { cx: 0.5, cy: 0.5, scale: 1, angle: Math.PI / 2 }, flat)!;
    expect(layout.rotate.x).toBeLessThan(500 - ROTATE_HANDLE_OFFSET); // the top edge now faces left
    expect(layout.rotate.y).toBeCloseTo(500, 6);
  });

  it('TestCloneR23_a_point_the_view_cannot_show_gives_no_layout', () => {
    expect(layoutHandles(FRAME, { cx: 0.5, cy: 0.5, scale: 1, angle: 0 }, () => null)).toBeNull();
  });
});
