// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMaskView } from '../../../../src/materialgen/app/project/useMaskView';

describe('materialgen/masks R55 materialgen/preview R28 the mask view state', () => {
  it('R55 the overlay is off and the Material Masks panel closed at the start of a session', () => {
    const { result } = renderHook(() => useMaskView());
    expect(result.current.overlay).toBe(false);
    expect(result.current.open).toBe(false);
  });

  it('R55 the overlay and the panel are two switches shared by the viewport icon and the panel', () => {
    const { result } = renderHook(() => useMaskView());
    act(() => result.current.onOverlay(true));
    expect(result.current.overlay).toBe(true);
    expect(result.current.open).toBe(false);
    act(() => result.current.onOpenChange(true));
    expect(result.current.open).toBe(true);
    expect(result.current.overlay).toBe(true);
  });
});
