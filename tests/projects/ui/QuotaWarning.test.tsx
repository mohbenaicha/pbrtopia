// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { QuotaWarning, type QuotaWarningProps } from '../../../src/projects/ui/QuotaWarning';

afterEach(cleanup);

const MIB = 1024 * 1024;
const GIB = 1024 * MIB;

function show(overrides: Partial<QuotaWarningProps> = {}) {
  const onExport = vi.fn();
  render(<QuotaWarning estimate={{ usedBytes: GIB - 120 * MIB, quotaBytes: GIB }} full={false} onExport={onExport} exporting={false} error={null} {...overrides} />);
  return { onExport };
}

describe('QuotaWarning', () => {
  it('R2 low space says how much is free of the quota and offers to export', () => {
    show();
    expect(screen.getByRole('status').textContent).toContain('120 MB free of 1 GB');
    expect(screen.getByRole('button', { name: 'Export project' })).toBeTruthy();
  });

  it('R2 the Export project button calls back', () => {
    const { onExport } = show();
    fireEvent.click(screen.getByRole('button', { name: 'Export project' }));
    expect(onExport).toHaveBeenCalledTimes(1);
  });

  it('R2 a full store says changes cannot be saved, whether or not an estimate is known', () => {
    show({ full: true, estimate: null });
    expect(screen.getByRole('status').textContent).toContain('Browser storage is full, so changes cannot be saved.');
    expect(screen.getByRole('button', { name: 'Export project' })).toBeTruthy();
  });

  it('R2 a busy export disables the button', () => {
    const { onExport } = show({ exporting: true });
    const button = screen.getByRole('button', { name: 'Export project' }) as HTMLButtonElement;
    fireEvent.click(button);
    expect(onExport).not.toHaveBeenCalled();
  });

  it('R2 an export failure is shown as an alert', () => {
    show({ error: 'The zip could not be written.' });
    expect(screen.getByRole('alert').textContent).toBe('The zip could not be written.');
  });

  it('R2 sizes read in KB, MB and GB with one decimal only when needed', () => {
    show({ estimate: { usedBytes: 0, quotaBytes: Math.round(1.5 * GIB) } });
    expect(screen.getByRole('status').textContent).toContain('1.5 GB free of 1.5 GB');
  });
});
