// @vitest-environment jsdom
import { act, cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Vector3 } from 'three';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { createCameraRig } from '../../../src/viewport/cameraRig';
import { createViewportEvents } from '../../../src/viewport/viewportEvents';
import { ViewportCorner, type CornerViewport } from '../../../src/viewport/ui/ViewportCorner';

afterEach(cleanup);

function fakeViewport() {
  const rig = createCameraRig(1);
  rig.resetView();
  const events = createViewportEvents();
  const viewport: CornerViewport = {
    get camera() {
      return rig.active;
    },
    cameraRig: rig,
    on: events.on,
    snapToAxis: vi.fn(),
    setProjection: vi.fn(),
    resetView: vi.fn(),
  };
  return { viewport, rig, events };
}

const stackOrder = (name: string): number => Number(screen.getByRole('button', { name }).style.zIndex);

describe('ViewportCorner', () => {
  it('R11 it holds the gizmo, then the gear, the camera icon, Reset view and the grid toggle, with the stable test ids', () => {
    const { viewport } = fakeViewport();
    render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    const ids = ['viewport-gizmo', 'viewport-gear', 'viewport-camera', 'viewport-reset', 'viewport-grid'];
    const found = screen.getAllByTestId(/^viewport-(gizmo|gear|camera|reset|grid)$/).map((element) => element.getAttribute('data-testid'));
    expect(found).toEqual(ids);
    expect(screen.getByTestId('viewport-gear').getAttribute('aria-label')).toBe('Viewport settings');
    expect(screen.getByTestId('viewport-reset').getAttribute('aria-label')).toBe('Reset view');
  });

  it('R11 Reset view asks the viewport to reset the camera', async () => {
    const { viewport } = fakeViewport();
    render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(viewport.resetView).toHaveBeenCalledTimes(1);
  });

  it('R24 the grid toggle shows pressed while the grid is shown and asks for the opposite on a click', async () => {
    const { viewport } = fakeViewport();
    const onGridShownChange = vi.fn();
    const { rerender } = render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={onGridShownChange} />);
    const toggle = screen.getByTestId('viewport-grid');
    expect(toggle.getAttribute('aria-label')).toBe('Grid');
    expect(toggle.getAttribute('aria-pressed')).toBe('true');
    await userEvent.click(toggle);
    expect(onGridShownChange).toHaveBeenLastCalledWith(false);
    rerender(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown={false} onGridShownChange={onGridShownChange} />);
    expect(screen.getByTestId('viewport-grid').getAttribute('aria-pressed')).toBe('false');
    await userEvent.click(screen.getByTestId('viewport-grid'));
    expect(onGridShownChange).toHaveBeenLastCalledWith(true);
  });

  it('R14 the gear asks to open the settings, shows pressed while they are open, and the panel appears under it', async () => {
    const { viewport } = fakeViewport();
    const onSettingsOpenChange = vi.fn();
    const { rerender } = render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={onSettingsOpenChange} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    expect(screen.getByTestId('viewport-gear').getAttribute('aria-pressed')).toBe('false');
    expect(screen.queryByRole('dialog')).toBeNull();
    await userEvent.click(screen.getByTestId('viewport-gear'));
    expect(onSettingsOpenChange).toHaveBeenLastCalledWith(true);
    rerender(<ViewportCorner viewport={viewport} settingsOpen onSettingsOpenChange={onSettingsOpenChange} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    expect(screen.getByTestId('viewport-gear').getAttribute('aria-pressed')).toBe('true');
    expect(screen.getByRole('dialog', { name: 'Viewport settings' }).textContent).toBe('panel');
  });

  it('R14 clicking the gear while the settings are open asks to close them, and so do Escape and a click elsewhere', async () => {
    const { viewport } = fakeViewport();
    const onSettingsOpenChange = vi.fn();
    render(<ViewportCorner viewport={viewport} settingsOpen onSettingsOpenChange={onSettingsOpenChange} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    await userEvent.click(screen.getByTestId('viewport-gear'));
    expect(onSettingsOpenChange).toHaveBeenLastCalledWith(false);
    await userEvent.keyboard('{Escape}');
    expect(onSettingsOpenChange).toHaveBeenCalledTimes(2);
    await userEvent.click(document.body);
    expect(onSettingsOpenChange).toHaveBeenCalledTimes(3);
  });

  it('R12 the camera icon follows the viewport projection and asks for the other one', async () => {
    const { viewport, events } = fakeViewport();
    render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    await userEvent.click(screen.getByTestId('viewport-camera'));
    expect(viewport.setProjection).toHaveBeenLastCalledWith('orthographic');

    viewport.cameraRig.setProjection('orthographic');
    act(() => events.emit('projection-changed', 'orthographic'));
    expect(screen.getByTestId('viewport-camera').querySelector('[data-icon]')!.getAttribute('data-icon')).toBe('orthographic');
    await userEvent.click(screen.getByTestId('viewport-camera'));
    expect(viewport.setProjection).toHaveBeenLastCalledWith('perspective');
  });

  it('R13 a gizmo click goes to snapToAxis', async () => {
    const { viewport } = fakeViewport();
    render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    await userEvent.click(screen.getByRole('button', { name: 'View from +X' }));
    expect(viewport.snapToAxis).toHaveBeenCalledWith('+x');
  });

  it('materialgen preview R26 R29 the corner can leave out the gizmo, the camera toggle and the grid, and Reset view can be the caller\'s', async () => {
    const { viewport } = fakeViewport();
    const onResetView = vi.fn();
    render(
      <ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} showAxisGizmo={false} showCameraToggle={false} showGridToggle={false} onResetView={onResetView} moreButtons={<button>More</button>} />,
    );
    const found = screen.getAllByTestId(/^viewport-(gizmo|gear|camera|reset|grid)$/).map((element) => element.getAttribute('data-testid'));
    expect(found).toEqual(['viewport-gear', 'viewport-reset']);
    await userEvent.click(screen.getByRole('button', { name: 'Reset view' }));
    expect(onResetView).toHaveBeenCalledTimes(1);
    expect(viewport.resetView).not.toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'More' })).toBeTruthy();
  });

  it('R13 the gizmo turns with the camera', () => {
    const { viewport, rig, events } = fakeViewport();
    render(<ViewportCorner viewport={viewport} settingsOpen={false} onSettingsOpenChange={() => undefined} settingsPanel={<p>panel</p>} gridShown onGridShownChange={() => undefined} />);
    expect(stackOrder('View from +Z')).toBeGreaterThan(stackOrder('View from -X'));
    rig.placeCamera(new Vector3(-1, 0, 0), 3);
    act(() => events.emit('camera-change'));
    expect(stackOrder('View from -X')).toBeGreaterThan(stackOrder('View from +Z'));
  });
});
