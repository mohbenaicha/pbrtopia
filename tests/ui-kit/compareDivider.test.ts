import { describe, expect, it } from 'vitest';
import { DIVIDER_START, dividerPercentAt, stepDivider } from '../../src/ui-kit/compareDivider';

describe('ui-kit compareDivider (materialgen-prep R43)', () => {
  it('R43 the divider starts at the middle', () => {
    expect(DIVIDER_START).toBe(50);
  });

  it('R43 a pointer position becomes a percentage of the picture area, clamped to 0..100', () => {
    const rect = { left: 100, width: 400 };
    expect(dividerPercentAt(300, rect)).toBe(50);
    expect(dividerPercentAt(100, rect)).toBe(0);
    expect(dividerPercentAt(50, rect)).toBe(0);
    expect(dividerPercentAt(900, rect)).toBe(100);
    expect(dividerPercentAt(200, rect)).toBe(25);
  });

  it('R43 an empty area gives the middle rather than NaN', () => {
    expect(dividerPercentAt(10, { left: 0, width: 0 })).toBe(50);
  });

  it('R43 arrows move by 1, Shift+arrow by 10, Home and End go to the ends, and the value stays within 0..100', () => {
    expect(stepDivider(50, 'ArrowRight', false)).toBe(51);
    expect(stepDivider(50, 'ArrowLeft', false)).toBe(49);
    expect(stepDivider(50, 'ArrowRight', true)).toBe(60);
    expect(stepDivider(50, 'ArrowLeft', true)).toBe(40);
    expect(stepDivider(50, 'Home', false)).toBe(0);
    expect(stepDivider(50, 'End', false)).toBe(100);
    expect(stepDivider(3, 'ArrowLeft', true)).toBe(0);
    expect(stepDivider(98, 'ArrowRight', true)).toBe(100);
  });

  it('R43 up and down arrows act like right and left, and other keys change nothing', () => {
    expect(stepDivider(50, 'ArrowUp', false)).toBe(51);
    expect(stepDivider(50, 'ArrowDown', false)).toBe(49);
    expect(stepDivider(50, 'a', false)).toBeNull();
  });
});
