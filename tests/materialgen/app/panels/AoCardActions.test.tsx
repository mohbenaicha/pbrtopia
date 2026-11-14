// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { AoCardActions } from '@mat/app/panels/AoCardActions';
import { describeTooltipOf, openTooltipTextOf } from '../../../support/tooltipDescription';

afterEach(cleanup);

function show(patch: Partial<React.ComponentProps<typeof AoCardActions>> = {}) {
  const handlers = { onOpenTool: vi.fn(), onRegenerate: vi.fn(async () => undefined) };
  render(<AoCardActions hasSource canWrite readOnlyReason="Open in another tab" opOpen={false} busy={false} {...handlers} {...patch} />);
  return handlers;
}
const tool = (): HTMLButtonElement => screen.getByRole('button', { name: 'AO tool' }) as HTMLButtonElement;
const regenerate = (): HTMLButtonElement => screen.getByRole('button', { name: 'Regenerate AO' }) as HTMLButtonElement;

describe('materialgen/app AoCardActions', () => {
  it('app tooltips R1 R5 both buttons have a tooltip, a name and one sentence, and no native title', () => {
    show();
    for (const button of [tool(), regenerate()]) {
      expect(button.getAttribute('title')).toBeNull();
      const name = button.getAttribute('aria-label') ?? '';
      const words = openTooltipTextOf(button);
      expect(words.startsWith(`${name}. `)).toBe(true);
      expect(words.length).toBeLessThanOrEqual(name.length + 2 + 140);
    }
  });

  it('R43 R44 both buttons work when a height or normal map exists', () => {
    const handlers = show();
    fireEvent.click(tool());
    fireEvent.click(regenerate());
    expect(handlers.onOpenTool).toHaveBeenCalledTimes(1);
    expect(handlers.onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('R43 R44 with no source both are disabled and the reason is "Needs a height or normal map."', () => {
    show({ hasSource: false });
    for (const button of [tool(), regenerate()]) {
      expect(button.disabled).toBe(true);
      expect(describeTooltipOf(button)).toContain('Needs a height or normal map.');
    }
  });

  it('R9 both are disabled while another op session is open', () => {
    show({ opOpen: true });
    expect(tool().disabled).toBe(true);
    expect(regenerate().disabled).toBe(true);
    expect(describeTooltipOf(regenerate())).toContain('Another edit is open');
  });

  it('R13 both are disabled in a read-only tab, with that reason', () => {
    show({ canWrite: false });
    expect(tool().disabled).toBe(true);
    expect(describeTooltipOf(regenerate())).toContain('Open in another tab');
  });

  it('R44 both are disabled while the AO map is being changed', () => {
    show({ busy: true });
    expect(tool().disabled).toBe(true);
    expect(regenerate().disabled).toBe(true);
  });

  it('R44 Regenerate cannot be pressed again while it is running', async () => {
    let finish: () => void = () => undefined;
    const onRegenerate = vi.fn(() => new Promise<void>((resolve) => { finish = resolve; }));
    show({ onRegenerate });
    fireEvent.click(regenerate());
    await waitFor(() => expect(regenerate().getAttribute('aria-busy')).toBe('true'));
    fireEvent.click(regenerate());
    expect(onRegenerate).toHaveBeenCalledTimes(1);
    expect(tool().disabled).toBe(true);
    finish();
    await waitFor(() => expect(regenerate().getAttribute('aria-busy')).toBeNull());
  });
});
