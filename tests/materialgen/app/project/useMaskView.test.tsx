// @vitest-environment jsdom
import { act, renderHook } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { useMaskView } from '../../../../src/materialgen/app/project/useMaskView';

describe('materialgen/masks R55 the mask view state', () => {
  it('R55 the overlay is off at the start of a session', () => {
    const { result } = renderHook(() => useMaskView());
    expect(result.current.overlay).toBe(false);
  });

  it('R55 the overlay switch is session state that the popover turns on and off', () => {
    const { result } = renderHook(() => useMaskView());
    act(() => result.current.onOverlay(true));
    expect(result.current.overlay).toBe(true);
    act(() => result.current.onOverlay(false));
    expect(result.current.overlay).toBe(false);
  });
});
