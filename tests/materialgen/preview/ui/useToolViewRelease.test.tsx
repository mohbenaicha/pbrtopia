// @vitest-environment jsdom
import { renderHook } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ToolTransform } from '../../../../src/materialgen/preview/material/toolTransform';
import { useToolViewRelease, type ToolView } from '../../../../src/materialgen/preview/ui/useToolViewRelease';

const TRANSFORM: ToolTransform = { kind: 'crop', rect: { x: 0.1, y: 0, width: 0.9, height: 1 }, edge: null };
const view = (hold: boolean): ToolView => ({ transform: TRANSFORM, baseKeys: { albedo: 'a1', normal: 'n1' }, hold });

function run(initial: ToolView | null, keys: Record<string, string>) {
  const onSettled = vi.fn();
  const hook = renderHook((props: { view: ToolView | null; keys: Record<string, string> }) => useToolViewRelease(props.view, props.keys, onSettled), { initialProps: { view: initial, keys } });
  return { hook, onSettled };
}

describe('materialgen/preview R58 the tool view and its release', () => {
  it('imageops R53 an open tool shows its transform', () => {
    const { hook, onSettled } = run(view(false), { albedo: 'a1', normal: 'n1' });
    expect(hook.result.current).toBe(TRANSFORM);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('imageops R59 no tool view shows no transform', () => {
    expect(run(null, { albedo: 'a1' }).hook.result.current).toBeNull();
  });

  it('imageops R59 a held view stays while any map still has the key it was set against', () => {
    const { hook, onSettled } = run(view(true), { albedo: 'a2', normal: 'n1' });
    expect(hook.result.current).toBe(TRANSFORM);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('imageops R59 a held view is released in the render in which every map has its committed copy', () => {
    const { hook, onSettled } = run(view(true), { albedo: 'a1', normal: 'n1' });
    hook.rerender({ view: view(true), keys: { albedo: 'a2', normal: 'n2' } });
    expect(hook.result.current).toBeNull(); // the same render, so no frame shows the transform on a committed map
    expect(onSettled).toHaveBeenCalledTimes(1);
  });

  it('imageops R59 an open (not held) view is never released by a changed key', () => {
    const { hook, onSettled } = run(view(false), { albedo: 'a1', normal: 'n1' });
    hook.rerender({ view: view(false), keys: { albedo: 'a2', normal: 'n2' } });
    expect(hook.result.current).toBe(TRANSFORM);
    expect(onSettled).not.toHaveBeenCalled();
  });

  it('imageops R59 a map that is no longer decoded counts as committed', () => {
    const { hook } = run(view(true), { albedo: 'a1', normal: 'n1' });
    hook.rerender({ view: view(true), keys: { albedo: 'a2' } });
    expect(hook.result.current).toBeNull();
  });
});
