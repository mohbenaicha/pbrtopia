// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { LoadingOverlay } from '../../src/ui-kit';

afterEach(cleanup);

describe('LoadingOverlay', () => {
  it('viewport-layout R31 announces itself as a polite status named by its label', () => {
    render(<LoadingOverlay label="Loading model" />);
    const overlay = screen.getByTestId('loading-overlay');
    expect(overlay.getAttribute('role')).toBe('status');
    expect(overlay.getAttribute('aria-live')).toBe('polite');
    expect(overlay.getAttribute('aria-label')).toBe('Loading model');
    expect(overlay.textContent).toContain('Loading model');
  });

  it('viewport-layout R31 draws nothing without a label', () => {
    render(<LoadingOverlay label="" />);
    expect(screen.queryByTestId('loading-overlay')).toBeNull();
  });

  it('viewport-layout R31 shows the detail line only when it is given', () => {
    const { rerender } = render(<LoadingOverlay label="Generating UVs" />);
    expect(screen.queryByTestId('loading-overlay-detail')).toBeNull();
    rerender(<LoadingOverlay label="Generating UVs" detail="Packing charts" />);
    expect(screen.getByTestId('loading-overlay-detail').textContent).toBe('Packing charts');
  });

  it('viewport-layout R31 draws no bar without progress, an indeterminate bar at 0 and a filled bar from a fraction', () => {
    const { rerender } = render(<LoadingOverlay label="Working" />);
    expect(screen.queryByRole('progressbar')).toBeNull();
    rerender(<LoadingOverlay label="Working" progress={0} />);
    const indeterminate = screen.getByRole('progressbar');
    expect(indeterminate.getAttribute('aria-valuenow')).toBeNull();
    expect(indeterminate.getAttribute('data-indeterminate')).toBe('true');
    rerender(<LoadingOverlay label="Working" progress={0.4} />);
    const bar = screen.getByRole('progressbar');
    expect(bar.getAttribute('aria-valuenow')).toBe('40');
    expect(bar.getAttribute('data-indeterminate')).toBeNull();
    expect(screen.getByTestId('loading-overlay-fill').style.width).toBe('40%');
  });

  it('viewport-layout R31 a progress outside 0 to 1 is clamped', () => {
    const { rerender } = render(<LoadingOverlay label="Working" progress={7} />);
    expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
    rerender(<LoadingOverlay label="Working" progress={-2} />);
    expect(screen.getByRole('progressbar').getAttribute('data-indeterminate')).toBe('true');
  });

  it('viewport-layout R31 pointer input does not reach what is under it', () => {
    const below = vi.fn();
    render(
      <div onPointerDown={below} onWheel={below} onClick={below}>
        <LoadingOverlay label="Loading model" />
      </div>,
    );
    const overlay = screen.getByTestId('loading-overlay');
    fireEvent.pointerDown(overlay);
    fireEvent.wheel(overlay);
    fireEvent.click(overlay);
    expect(below).not.toHaveBeenCalled();
  });
});
