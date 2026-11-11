// @vitest-environment jsdom
import { cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { canLeaveRoute, setRouteGuard } from '../../../src/shell/routing/routeGuard';
import { useRouteGuard } from '../../../src/shell/routing/useRouteGuard';

afterEach(() => {
  cleanup();
  setRouteGuard(null);
});

describe('route guard', () => {
  it('projects R15 with no guard a move is allowed', async () => {
    expect(await canLeaveRoute()).toBe(true);
  });

  it('projects R15 the registered guard decides', async () => {
    setRouteGuard(async () => false);
    expect(await canLeaveRoute()).toBe(false);
    setRouteGuard(async () => true);
    expect(await canLeaveRoute()).toBe(true);
  });

  it('projects R15 a view registers its guard while shown, with its latest state, and removes it when it goes', async () => {
    const first = vi.fn(async () => false);
    const second = vi.fn(async () => true);
    const hook = renderHook(({ canLeave }) => useRouteGuard(canLeave), { initialProps: { canLeave: first } });
    expect(await canLeaveRoute()).toBe(false);
    hook.rerender({ canLeave: second });
    expect(await canLeaveRoute()).toBe(true);
    expect(first).toHaveBeenCalledTimes(1);
    hook.unmount();
    expect(await canLeaveRoute()).toBe(true);
    expect(second).toHaveBeenCalledTimes(1);
  });
});
