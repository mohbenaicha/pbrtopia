import { describe, expect, it } from 'vitest';
import { placeCard } from '../../src/tutorial/placeCard';

const WINDOW = { width: 1000, height: 700 };
const CARD = { width: 320, height: 220 };
const box = (left: number, top: number, width: number, height: number) => ({ left, top, right: left + width, bottom: top + height, width, height });

describe('placeCard (tutorial R6)', () => {
  it('TestR6_goes_below_the_target_when_it_fits_centred_on_it', () => {
    const place = placeCard(box(400, 100, 100, 40), CARD, WINDOW);
    expect(place.side).toBe('below');
    expect(place.top).toBeGreaterThan(140);
    expect(place.left + CARD.width / 2).toBeCloseTo(450, 0);
  });

  it('TestR6_goes_above_when_there_is_no_room_below', () => {
    const place = placeCard(box(400, 600, 100, 40), CARD, WINDOW);
    expect(place.side).toBe('above');
    expect(place.top + CARD.height).toBeLessThan(600);
  });

  it('TestR6_goes_beside_a_target_that_leaves_no_room_above_or_below', () => {
    const place = placeCard(box(20, 10, 200, 680), CARD, WINDOW);
    expect(place.side).toBe('right');
    expect(place.left).toBeGreaterThan(220);
  });

  it('TestR6_goes_left_when_only_the_left_has_room', () => {
    const place = placeCard(box(760, 10, 230, 680), CARD, WINDOW);
    expect(place.side).toBe('left');
    expect(place.left + CARD.width).toBeLessThan(760);
  });

  it('TestR6_is_centred_without_an_arrow_when_the_target_fills_the_window_or_is_missing', () => {
    expect(placeCard(box(0, 0, 1000, 700), CARD, WINDOW).side).toBe('center');
    const none = placeCard(null, CARD, WINDOW);
    expect(none.side).toBe('center');
    expect(none.left).toBe((WINDOW.width - CARD.width) / 2);
    expect(none.top).toBe((WINDOW.height - CARD.height) / 2);
  });

  it('TestR6_stays_inside_the_window_at_the_edges', () => {
    const place = placeCard(box(0, 100, 40, 30), CARD, WINDOW);
    expect(place.left).toBeGreaterThanOrEqual(8);
    const right = placeCard(box(980, 100, 20, 30), CARD, WINDOW);
    expect(right.left + CARD.width).toBeLessThanOrEqual(WINDOW.width - 8);
  });
});
