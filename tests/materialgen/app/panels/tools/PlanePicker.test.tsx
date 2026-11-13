// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { PlanePicker } from '@mat/app/panels/tools/PlanePicker';
import { ViewAngleContext } from '@mat/app/panels/tools/ViewAngleContext';
import { createViewAngleStore } from '@mat/app/panels/tools/viewAngleStore';

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

const EDGES = ['Top', 'Left', 'Right', 'Bottom'];
const CORNERS = ['TL', 'TR', 'BL', 'BR'];
const edgeProps = () => ({ handles: 'edges' as const, edgeTitle: (edge: string) => `Remove 8 px from the ${edge}`, onEdge: vi.fn(), onEdgeMark: vi.fn() });
const cornerProps = (selected: string[] = ['TL', 'TR']) => ({ handles: 'corners' as const, selected: new Set(selected) as never, onCorner: vi.fn() });
const handle = (name: string): HTMLButtonElement => screen.getByRole('button', { name }) as HTMLButtonElement;
const plane = (): HTMLElement => screen.getByTestId('plane-picker-plane');

describe('materialgen/app PlanePicker', () => {
  it('R71 Crop\'s picker has the four edge handles and no corner handle', () => {
    render(<PlanePicker {...edgeProps()} />);
    for (const name of EDGES) expect(handle(name)).toBeTruthy();
    for (const name of CORNERS) expect(screen.queryByRole('button', { name })).toBeNull();
    expect(screen.queryAllByRole('checkbox')).toHaveLength(0);
  });

  it('R71 Mirror\'s picker has the four corner handles and no edge handle', () => {
    render(<PlanePicker {...cornerProps()} />);
    for (const name of CORNERS) expect(handle(name)).toBeTruthy();
    for (const name of EDGES) expect(screen.queryByRole('button', { name })).toBeNull();
  });

  it('R71 R57 an edge handle carries the tooltip of what it removes', () => {
    render(<PlanePicker {...edgeProps()} />);
    expect(handle('Top').title).toBe('Remove 8 px from the top');
    expect(handle('Bottom').title).toBe('Remove 8 px from the bottom');
  });

  it('R71 corner handles are gold while selected and grey otherwise, and keep that until clicked again', () => {
    const props = cornerProps(['TL', 'TR']);
    render(<PlanePicker {...props} />);
    expect(handle('TL').getAttribute('aria-pressed')).toBe('true');
    expect(handle('TL').dataset.active).toBe('true');
    expect(handle('BL').getAttribute('aria-pressed')).toBe('false');
    expect(handle('BL').dataset.active).toBe('false');
    fireEvent.click(handle('BL'));
    expect(props.onCorner).toHaveBeenCalledWith('BL');
    expect(handle('BL').dataset.active).toBe('false'); // the selection is the owner's; a click alone does not hold it
  });

  it('R71 an edge handle is gold only for a short flash after a click, then grey again; it is never held', () => {
    vi.useFakeTimers();
    const props = edgeProps();
    render(<PlanePicker {...props} />);
    expect(handle('Top').dataset.active).toBe('false');
    fireEvent.click(handle('Top'));
    expect(props.onEdge).toHaveBeenCalledWith('top');
    expect(handle('Top').dataset.active).toBe('true');
    expect(handle('Left').dataset.active).toBe('false');
    act(() => void vi.advanceTimersByTime(199));
    expect(handle('Top').dataset.active).toBe('true');
    act(() => void vi.advanceTimersByTime(2));
    expect(handle('Top').dataset.active).toBe('false');
  });

  it('R71 an edge handle is also gold while the pointer is held down on it', () => {
    render(<PlanePicker {...edgeProps()} />);
    fireEvent.pointerDown(handle('Left'));
    expect(handle('Left').dataset.active).toBe('true');
    fireEvent.pointerUp(handle('Left'));
    fireEvent.pointerLeave(handle('Left'));
    expect(handle('Left').dataset.active).toBe('false');
  });

  it('R73 hovering or focusing an edge handle marks that edge in the viewport, and leaving clears the mark', () => {
    const props = edgeProps();
    render(<PlanePicker {...props} />);
    for (const [name, edge] of [['Top', 'top'], ['Left', 'left'], ['Right', 'right'], ['Bottom', 'bottom']] as const) {
      fireEvent.mouseEnter(handle(name));
      expect(props.onEdgeMark).toHaveBeenLastCalledWith(edge);
      fireEvent.mouseLeave(handle(name));
      expect(props.onEdgeMark).toHaveBeenLastCalledWith(null);
    }
    fireEvent.focus(handle('Bottom'));
    expect(props.onEdgeMark).toHaveBeenLastCalledWith('bottom');
    fireEvent.blur(handle('Bottom'));
    expect(props.onEdgeMark).toHaveBeenLastCalledWith(null);
  });

  it('R73 the handles are real buttons, so Space and Enter act as a click and they are in the tab order', () => {
    render(<PlanePicker {...edgeProps()} />);
    for (const name of EDGES) {
      expect(handle(name).tagName).toBe('BUTTON');
      expect(handle(name).tabIndex).toBeGreaterThanOrEqual(0);
    }
  });

  it('R72 the plane is turned clockwise by the angle of the view and follows the store as it changes', () => {
    const store = createViewAngleStore();
    render(<ViewAngleContext.Provider value={store}><PlanePicker {...edgeProps()} /></ViewAngleContext.Provider>);
    expect(plane().style.transform).toContain('rotateZ(0deg)');
    act(() => store.set(90));
    expect(plane().style.transform).toContain('rotateZ(90deg)');
    act(() => store.set(-30));
    expect(plane().style.transform).toContain('rotateZ(-30deg)');
  });

  it('R74 the store is watched exactly while a picker is on screen', () => {
    const store = createViewAngleStore();
    const { unmount } = render(<ViewAngleContext.Provider value={store}><PlanePicker {...cornerProps()} /></ViewAngleContext.Provider>);
    expect(store.isWatched()).toBe(true);
    unmount();
    expect(store.isWatched()).toBe(false);
  });

  it('R72 with no provider the plane stands upright', () => {
    render(<PlanePicker {...cornerProps()} />);
    expect(plane().style.transform).toContain('rotateZ(0deg)');
  });

  it('R71 the stylesheet makes the handles easy to reach: edges 60 % long and 2 rem thick at least, corners 2.5 rem square at least', () => {
    const css = readFileSync(resolve(__dirname, '../../../../../src/materialgen/app/panels/tools/planePicker.css'), 'utf8');
    expect(css).toMatch(/\.plane-picker__edge[^}]*min-(height|width): 2rem/s);
    expect(css).toMatch(/--edge-length: 60%/);
    expect(css).toMatch(/\.plane-picker__corner[^}]*min-width: 2\.5rem[^}]*min-height: 2\.5rem/s);
    expect(css).toMatch(/var\(--accent\)/); // gold is the theme's accent
  });
});
