// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Viewport } from '../../../src/viewport/createViewport';
import { ViewportCanvas } from '../../../src/viewport/ui/ViewportCanvas';

const created = vi.hoisted(() => ({ calls: [] as unknown[], events: [] as string[], viewport: { dispose: () => undefined } }));

vi.mock('../../../src/viewport/createViewport', () => ({
  createViewport: (host: unknown) => {
    created.calls.push(host);
    return created.viewport;
  },
}));

beforeEach(() => {
  created.calls = [];
  created.events = [];
  created.viewport.dispose = () => void created.events.push('dispose');
});
afterEach(cleanup);

describe('ViewportCanvas', () => {
  it('R16 R2 the surface carries the Shortcuts panel with the orbit gestures by default', () => {
    render(<ViewportCanvas />);
    expect(screen.getByTestId('viewport')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Shortcuts' })).toBeTruthy();
    expect(screen.getByText('Orbit')).toBeTruthy();
    expect(screen.getByText('Middle-drag')).toBeTruthy();
  });

  it('R2 a set given by the owner replaces the default', () => {
    render(<ViewportCanvas shortcuts={{ id: 'own', entries: [{ keys: 'Alt + click', action: 'Set the marker' }] }} />);
    expect(screen.getByText('Set the marker')).toBeTruthy();
    expect(screen.queryByText('Orbit')).toBeNull();
  });

  it('A6 it creates one viewport in its own container and reports it ready', () => {
    const onReady = vi.fn();
    render(<ViewportCanvas onReady={onReady} />);
    expect(created.calls).toHaveLength(1);
    const host = created.calls[0] as HTMLElement;
    expect(screen.getByTestId('viewport').contains(host)).toBe(true);
    expect(host).not.toBe(screen.getByTestId('viewport'));
    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(created.viewport);
  });

  it('A6 leaving reports null first, then disposes the viewport, and a re-render creates no second viewport', () => {
    const onReady = vi.fn((viewport: Viewport | null) => void created.events.push(viewport === null ? 'ready:null' : 'ready:viewport'));
    const { rerender, unmount } = render(<ViewportCanvas onReady={onReady} />);
    rerender(<ViewportCanvas onReady={onReady} />);
    expect(created.calls).toHaveLength(1);
    unmount();
    expect(created.events).toEqual(['ready:viewport', 'ready:null', 'dispose']);
  });

  it('A6 the latest onReady is the one told about the disposal', () => {
    const first = vi.fn();
    const second = vi.fn();
    const { rerender, unmount } = render(<ViewportCanvas onReady={first} />);
    rerender(<ViewportCanvas onReady={second} />);
    unmount();
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledWith(null);
  });

  it('R16 the overlay is drawn with the created viewport and not before it exists', () => {
    const overlay = vi.fn((viewport: Viewport) => <p>{viewport === created.viewport ? 'overlay shown' : 'wrong viewport'}</p>);
    render(<ViewportCanvas overlay={overlay} />);
    expect(screen.getByText('overlay shown')).toBeTruthy();
    expect(overlay.mock.calls.every(([viewport]) => viewport === created.viewport)).toBe(true);
  });
});
