// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { PaintHost } from '@mat/preview';
import type { PaintSession } from '@mat/compositing/session/createPaintSession';
import { createPaintWorkspace } from '@mat/compositing/ui/createPaintWorkspace';
import type { ToolMode } from '@mat/compositing/ui/toolMode';

interface Fakes {
  log: string[];
  session: PaintSession;
  host: PaintHost;
  element: HTMLElement;
  canvasListeners: { onValuesChange: (() => void) | null; orbitFilter: unknown };
  stepResults: { painted: boolean; more: boolean }[];
  textures: { height: object | null; normal: object | null };
}

function makeFakes(): Fakes {
  const log: string[] = [];
  const element = document.createElement('canvas');
  const canvasListeners: Fakes['canvasListeners'] = { onValuesChange: null, orbitFilter: undefined };
  const stepResults: Fakes['stepResults'] = [];
  const textures: Fakes['textures'] = { height: null, normal: null };
  const session = {
    side: 8,
    step: () => stepResults.shift() ?? { painted: false, more: false },
    undo: () => { log.push('session.undo'); return true; },
    redo: () => { log.push('session.redo'); return true; },
    canUndo: () => true, canRedo: () => false, hasStrokes: () => true, notice: () => null,
    brush: () => ({ height: { on: true } }),
    textures: () => ({ albedo: {}, orm: {}, ...textures }),
    readHeightProxy: () => { log.push('proxy'); return null; },
    readPainted: () => { log.push('readPainted'); return { applied: [] }; },
    dispose: () => { log.push('session.dispose'); },
  } as unknown as PaintSession;
  const scene = {
    setPaintTextures: (value: unknown) => { log.push(value === null ? 'textures:null' : 'textures:set'); },
    setOrbitFilter: (filter: unknown) => { canvasListeners.orbitFilter = filter; log.push(filter === null ? 'orbit:null' : 'orbit:set'); },
    onValuesChange: (listener: () => void) => { canvasListeners.onValuesChange = listener; return () => { canvasListeners.onValuesChange = null; }; },
    paintSurface: () => ({ scale: 1, bias: 0, tilingX: 1, tilingY: 1 }),
    planeRay: () => null,
    planePoint: () => null,
  };
  const host = { scene, element, invalidate: () => { log.push('invalidate'); }, renderer: {}, normalDirection: () => 'opengl' } as unknown as PaintHost;
  return { log, session, host, element, canvasListeners, stepResults, textures };
}

function fakeMode(log: string[], name: string, busy = false): ToolMode {
  return { attach: () => { log.push(`${name}.attach`); }, detach: () => { log.push(`${name}.detach`); }, isBusy: () => busy, surfaceChanged: () => { log.push(`${name}.surfaceChanged`); } };
}

let frames: (() => void)[] = [];
beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback));
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
});
afterEach(() => vi.unstubAllGlobals());

describe('createPaintWorkspace (clone architecture C1)', () => {
  it('TestCloneR1_switching_modes_detaches_the_old_before_attaching_the_new_and_keeps_the_session', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    const stamp = fakeMode(fakes.log, 'stamp');
    const clone = fakeMode(fakes.log, 'clone');
    workspace.setMode(stamp);
    workspace.setMode(clone);
    workspace.setMode(clone); // the same mode again does nothing
    const order = fakes.log.filter((entry) => /attach|detach|dispose/.test(entry));
    expect(order).toEqual(['stamp.attach', 'stamp.detach', 'clone.attach']);
  });

  it('TestCloneR1_dispose_detaches_the_mode_then_puts_the_preview_back_and_disposes_the_session_once', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    workspace.setMode(fakeMode(fakes.log, 'stamp'));
    fakes.log.length = 0;
    workspace.dispose();
    workspace.dispose();
    expect(fakes.log).toEqual(['stamp.detach', 'orbit:null', 'textures:null', 'session.dispose']);
    expect(fakes.element.style.cursor).toBe('');
  });

  it('TestCloneR19_the_left_button_and_the_alt_wheel_belong_to_the_tool_not_the_turntable', () => {
    const fakes = makeFakes();
    createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    const filter = fakes.canvasListeners.orbitFilter as { ignoresPointer(event: object): boolean; ignoresWheel(event: object): boolean };
    expect(filter.ignoresPointer({ button: 0, pointerType: 'mouse' })).toBe(true);
    expect(filter.ignoresPointer({ button: 2, pointerType: 'mouse' })).toBe(false);
    expect(filter.ignoresPointer({ button: 0, pointerType: 'touch' })).toBe(false);
    expect(filter.ignoresWheel({ altKey: true })).toBe(true);
    expect(filter.ignoresWheel({ altKey: false })).toBe(false);
  });

  it('TestCloneR21_a_lost_context_is_reported_once_and_its_default_prevented', () => {
    const fakes = makeFakes();
    const onInterrupted = vi.fn();
    createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted });
    const event = new Event('webglcontextlost', { cancelable: true });
    fakes.element.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
    expect(onInterrupted).toHaveBeenCalledTimes(1);
  });

  it('TestCloneR16_ctrl_z_and_ctrl_shift_z_undo_and_redo_but_never_inside_a_text_field', () => {
    const fakes = makeFakes();
    createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, shiftKey: true }));
    const input = document.createElement('input');
    document.body.append(input);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true, bubbles: true }));
    input.remove();
    expect(fakes.log.filter((entry) => entry.startsWith('session.'))).toEqual(['session.undo', 'session.redo']);
  });

  it('TestCloneR16_undo_shows_the_new_textures_refreshes_the_height_proxy_and_redraws', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    fakes.log.length = 0;
    workspace.undo();
    expect(fakes.log).toEqual(['session.undo', 'proxy', 'invalidate']);
  });

  it('TestCloneR8_afterEdit_publishes_a_new_texture_set_the_first_time_height_or_normal_appears', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    fakes.log.length = 0;
    workspace.afterEdit();
    expect(fakes.log).toEqual(['invalidate']); // same texture set as at the start: not shown again
    fakes.textures.normal = {};
    workspace.afterEdit();
    expect(fakes.log).toContain('textures:set');
  });

  it('TestCloneR1_the_frame_loop_runs_while_work_remains_or_the_mode_is_busy_and_stops_after', () => {
    const fakes = makeFakes();
    let busy = true;
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    workspace.setMode({ ...fakeMode(fakes.log, 'stamp'), isBusy: () => busy });
    workspace.kick();
    workspace.kick(); // one frame requested at a time
    expect(frames).toHaveLength(1);
    fakes.stepResults.push({ painted: true, more: false });
    frames.shift()!();
    expect(frames).toHaveLength(1); // the mode is busy (a stroke is open)
    busy = false;
    frames.shift()!();
    expect(frames).toHaveLength(0);
  });

  it('TestCloneR1_state_changes_are_published_to_subscribers_only_when_a_field_changes', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    const listener = vi.fn();
    const stop = workspace.subscribe(listener);
    workspace.publish();
    workspace.publish();
    expect(listener).toHaveBeenCalledTimes(1);
    expect(workspace.state()).toEqual({ canUndo: true, canRedo: false, hasStrokes: true, notice: null });
    stop();
  });

  it('TestCloneR16_undo_redo_and_ctrl_z_do_nothing_while_the_mode_locks_the_history', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    workspace.setMode({ ...fakeMode(fakes.log, 'clone'), locksHistory: () => true });
    fakes.log.length = 0;
    workspace.undo();
    workspace.redo();
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'z', ctrlKey: true }));
    expect(fakes.log).toEqual([]);
  });

  it('TestCloneR9_a_mode_that_asks_for_it_is_told_of_every_frame', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    let seen = 0;
    workspace.setMode({ ...fakeMode(fakes.log, 'clone', true), onFrame: () => { seen += 1; } });
    workspace.kick();
    frames.shift()!();
    frames.shift()!();
    expect(seen).toBe(2);
  });

  it('TestCloneR1_a_change_of_the_preview_surface_reaches_the_current_mode', () => {
    const fakes = makeFakes();
    const workspace = createPaintWorkspace({ host: fakes.host, session: fakes.session, onInterrupted: () => undefined });
    workspace.setMode(fakeMode(fakes.log, 'clone'));
    fakes.canvasListeners.onValuesChange!();
    expect(fakes.log).toContain('clone.surfaceChanged');
  });
});
