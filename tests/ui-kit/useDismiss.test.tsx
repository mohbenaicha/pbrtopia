// @vitest-environment jsdom
import { cleanup, fireEvent, render, renderHook } from '@testing-library/react';
import { useRef } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { useDismiss } from '../../src/ui-kit/useDismiss';

afterEach(cleanup);

function Region({ open, onDismiss, outside }: { open: boolean; onDismiss: () => void; outside?: boolean }): React.JSX.Element {
  const region = useRef<HTMLDivElement>(null);
  useDismiss(open, region, onDismiss, outside);
  return (
    <div>
      <div ref={region} data-testid="inside"><button type="button">inside</button></div>
      <button type="button">outside</button>
    </div>
  );
}

describe('useDismiss', () => {
  it('R22 Escape dismisses while open', () => {
    const onDismiss = vi.fn();
    render(<Region open onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Enter' });
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('R22 a pointer press outside the region dismisses; one inside does not', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(<Region open onDismiss={onDismiss} />);
    fireEvent.pointerDown(getByText('inside'));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.pointerDown(getByText('outside'));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('R22 with outside turned off, only Escape dismisses', () => {
    const onDismiss = vi.fn();
    const { getByText } = render(<Region open onDismiss={onDismiss} outside={false} />);
    fireEvent.pointerDown(getByText('outside'));
    expect(onDismiss).not.toHaveBeenCalled();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('R22 while closed nothing dismisses, and listening starts when it opens and stops when it closes', () => {
    const onDismiss = vi.fn();
    const { getByText, rerender } = render(<Region open={false} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    fireEvent.pointerDown(getByText('outside'));
    expect(onDismiss).not.toHaveBeenCalled();
    rerender(<Region open onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
    rerender(<Region open={false} onDismiss={onDismiss} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it('R22 the newest callback is the one called, without re-listening', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender } = render(<Region open onDismiss={first} />);
    rerender(<Region open onDismiss={second} />);
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(first).not.toHaveBeenCalled();
    expect(second).toHaveBeenCalledTimes(1);
  });

  it('R22 it stops listening when the component goes away', () => {
    const onDismiss = vi.fn();
    const { unmount } = render(<Region open onDismiss={onDismiss} />);
    unmount();
    fireEvent.keyDown(document, { key: 'Escape' });
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('R22 a region with nothing attached yet does not dismiss on a pointer press', () => {
    const onDismiss = vi.fn();
    renderHook(() => useDismiss(true, { current: null }, onDismiss));
    fireEvent.pointerDown(document.body);
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
