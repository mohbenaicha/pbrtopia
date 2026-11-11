import { describe, expect, it } from 'vitest';
import { QUADRANTS, availableMirrorModes, toggleQuadrant, type Quadrant } from '@mat/imageops';

const set = (...quadrants: Quadrant[]): ReadonlySet<Quadrant> => new Set(quadrants);
const sorted = (selection: ReadonlySet<Quadrant>): Quadrant[] => QUADRANTS.filter((quadrant) => selection.has(quadrant));

describe('toggleQuadrant (imageops R32 selection rules)', () => {
  it('R32 turning off the only selected quadrant is ignored: the selection is never empty', () => {
    expect(sorted(toggleQuadrant(set('TL'), 'TL'))).toEqual(['TL']);
  });

  it('R32 turning off one of two leaves the other', () => {
    expect(sorted(toggleQuadrant(set('TL', 'TR'), 'TR'))).toEqual(['TL']);
  });

  it('R32 with one selected, a quadrant that shares an edge is added to make a half', () => {
    expect(sorted(toggleQuadrant(set('TL'), 'TR'))).toEqual(['TL', 'TR']);
    expect(sorted(toggleQuadrant(set('TL'), 'BL'))).toEqual(['TL', 'BL']);
    expect(sorted(toggleQuadrant(set('BR'), 'TR'))).toEqual(['TR', 'BR']);
  });

  it('R32 with one selected, the diagonal one replaces it (a diagonal pair is not a half)', () => {
    expect(sorted(toggleQuadrant(set('TL'), 'BR'))).toEqual(['BR']);
    expect(sorted(toggleQuadrant(set('TR'), 'BL'))).toEqual(['BL']);
  });

  it('R32 with two selected, the new quadrant keeps the first of them that shares an edge with it', () => {
    expect(sorted(toggleQuadrant(set('TL', 'TR'), 'BL'))).toEqual(['TL', 'BL']); // BL touches TL (first), not TR
    expect(sorted(toggleQuadrant(set('TL', 'TR'), 'BR'))).toEqual(['TR', 'BR']); // BR touches TR only
    expect(sorted(toggleQuadrant(set('BL', 'BR'), 'TL'))).toEqual(['TL', 'BL']);
    expect(sorted(toggleQuadrant(set('TR', 'BR'), 'TL'))).toEqual(['TL', 'TR']);
  });

  it('R32 every reachable selection is a corner or a half, so a mode always fits', () => {
    let selection: ReadonlySet<Quadrant> = set('TL', 'TR');
    for (let step = 0; step < 200; step += 1) {
      selection = toggleQuadrant(selection, QUADRANTS[(step * 7 + (step >> 2)) % 4]!);
      expect([1, 2]).toContain(selection.size);
      expect(availableMirrorModes(selection).length).toBeGreaterThan(0);
    }
  });

  it('R32 returns a new set and never changes the one it was given', () => {
    const before = set('TL', 'TR');
    const after = toggleQuadrant(before, 'BL');
    expect(after).not.toBe(before);
    expect(sorted(before)).toEqual(['TL', 'TR']);
  });
});
