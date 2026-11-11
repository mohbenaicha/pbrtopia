import { describe, expect, it, vi } from 'vitest';
import { openSettings } from '../../../src/shell/routing/openSettings';

const steps = (overrides: Partial<Parameters<typeof openSettings>[0]> = {}) => ({
  isSetOpen: false,
  leaveSet: vi.fn(async () => true),
  isStillOpen: vi.fn(() => true),
  show: vi.fn(),
  ...overrides,
});

describe('openSettings', () => {
  it('settings R1 with no set open it goes straight to Settings', async () => {
    const s = steps();
    await openSettings(s);
    expect(s.leaveSet).not.toHaveBeenCalled();
    expect(s.show).toHaveBeenCalledOnce();
  });

  it('settings R1 with a set open it leaves the set first and then goes to Settings', async () => {
    const order: string[] = [];
    const s = steps({ isSetOpen: true, leaveSet: vi.fn(async () => (order.push('leave'), true)), show: vi.fn(() => void order.push('show')) });
    await openSettings(s);
    expect(order).toEqual(['leave', 'show']);
  });

  it('settings R1 when the set cannot be saved the user stays where they are', async () => {
    const s = steps({ isSetOpen: true, leaveSet: vi.fn(async () => false) });
    await openSettings(s);
    expect(s.show).not.toHaveBeenCalled();
  });

  it('settings R1 a view that is gone after the leave is not navigated from', async () => {
    const s = steps({ isSetOpen: true, isStillOpen: vi.fn(() => false) });
    await openSettings(s);
    expect(s.show).not.toHaveBeenCalled();
  });
});
