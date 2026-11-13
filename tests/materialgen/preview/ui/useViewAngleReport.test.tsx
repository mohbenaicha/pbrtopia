// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useViewAngleReport } from '@mat/preview/ui/useViewAngleReport';

type Frame = () => void;
let frames: Frame[] = [];
const nextFrame = (): void => {
  const run = frames;
  frames = [];
  run.forEach((frame) => frame());
};

beforeEach(() => {
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (frame: Frame) => frames.push(frame));
  vi.stubGlobal('cancelAnimationFrame', () => { frames = []; });
});
afterEach(() => vi.unstubAllGlobals());

const sceneAt = (state: { mesh: string; yaw: number }) => ({ view: () => ({ ...state, pitch: 0.7, dolly: 1 }) }) as never;

describe('materialgen/preview useViewAngleReport', () => {
  it('R72 R74 nothing runs while no tool panel is open', () => {
    const report = vi.fn();
    renderHook(() => useViewAngleReport(sceneAt({ mesh: 'plane', yaw: 1 }), false, report));
    expect(frames).toHaveLength(0);
    expect(report).not.toHaveBeenCalled();
  });

  it('R72 it reports the angle of the view on the first frame and again only when the angle changes', () => {
    const report = vi.fn();
    const state = { mesh: 'plane', yaw: Math.PI / 2 };
    renderHook(() => useViewAngleReport(sceneAt(state), true, report));
    nextFrame();
    expect(report).toHaveBeenCalledTimes(1);
    expect(report.mock.calls[0]![0]).toBeCloseTo(90, 6);
    nextFrame();
    nextFrame();
    expect(report).toHaveBeenCalledTimes(1);
    state.yaw = Math.PI;
    nextFrame();
    expect(report).toHaveBeenCalledTimes(2);
    expect(report.mock.calls[1]![0]).toBeCloseTo(180, 6);
  });

  it('R74 closing the panel stops the frame loop', () => {
    const report = vi.fn();
    const { rerender, unmount } = renderHook(({ active }) => useViewAngleReport(sceneAt({ mesh: 'plane', yaw: 0.5 }), active, report), { initialProps: { active: true } });
    nextFrame();
    rerender({ active: false });
    expect(frames).toHaveLength(0);
    unmount();
    expect(frames).toHaveLength(0);
  });

  it('R72 with no scene yet it reports nothing', () => {
    const report = vi.fn();
    renderHook(() => useViewAngleReport(null, true, report));
    nextFrame();
    expect(report).not.toHaveBeenCalled();
  });
});
