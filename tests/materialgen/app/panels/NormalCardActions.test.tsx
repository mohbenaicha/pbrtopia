// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { NormalCardActions } from '@mat/app/panels/NormalCardActions';
import { describeTooltipOf, openTooltipTextOf } from '../../../support/tooltipDescription';

afterEach(cleanup);

function show(patch: Partial<React.ComponentProps<typeof NormalCardActions>> = {}) {
  const handlers = { onOpenTool: vi.fn(), onRegenerate: vi.fn(async () => undefined) };
  render(<NormalCardActions hasHeight canWrite readOnlyReason="Open in another tab" opOpen={false} busy={false} {...handlers} {...patch} />);
  return handlers;
}
const tool = (): HTMLButtonElement => screen.getByRole('button', { name: 'Normal tool' }) as HTMLButtonElement;
const regenerate = (): HTMLButtonElement => screen.getByRole('button', { name: 'Regenerate normal' }) as HTMLButtonElement;

describe('materialgen/app NormalCardActions', () => {
  it('normal-from-height R4 both buttons have a tooltip, a name and one sentence, and no native title', () => {
    show();
    for (const button of [tool(), regenerate()]) {
      expect(button.getAttribute('title')).toBeNull();
      const name = button.getAttribute('aria-label') ?? '';
      const words = openTooltipTextOf(button);
      expect(words.startsWith(`${name}. `)).toBe(true);
      expect(words.length).toBeLessThanOrEqual(name.length + 2 + 140);
    }
    expect(openTooltipTextOf(tool())).toContain('Opens the settings for the normal map.');
    expect(openTooltipTextOf(regenerate())).toContain('Recalculates the normal map from the current height map.');
  });

  it('normal-from-height R4 both buttons work when a height map exists', () => {
    const handlers = show();
    fireEvent.click(tool());
    fireEvent.click(regenerate());
    expect(handlers.onOpenTool).toHaveBeenCalledTimes(1);
    expect(handlers.onRegenerate).toHaveBeenCalledTimes(1);
  });

  it('normal-from-height R3 R4 with no height map both are disabled and the reason is "Needs a height map."', () => {
    show({ hasHeight: false });
    for (const button of [tool(), regenerate()]) {
      expect(button.disabled).toBe(true);
      expect(describeTooltipOf(button)).toContain('Needs a height map.');
    }
  });

  it('normal-from-height R4 both are disabled while another op session is open', () => {
    show({ opOpen: true });
    expect(tool().disabled).toBe(true);
    expect(regenerate().disabled).toBe(true);
    expect(describeTooltipOf(regenerate())).toContain('Another edit is open. Apply or cancel it first.');
  });

  it('normal-from-height R4 both are disabled in a read-only tab, with that reason', () => {
    show({ canWrite: false });
    expect(tool().disabled).toBe(true);
    expect(describeTooltipOf(regenerate())).toContain('Open in another tab');
  });

  it('normal-from-height R4 both are disabled while the normal map or S is being changed, with that reason', () => {
    show({ busy: true });
    expect(tool().disabled).toBe(true);
    expect(regenerate().disabled).toBe(true);
    expect(describeTooltipOf(tool())).toContain('This map is being changed.');
  });

  it('normal-from-height R8 Regenerate cannot be pressed again while it is running', async () => {
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
