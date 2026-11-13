// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapsState } from '@mat/maps';
import { unassignMap } from '@mat/generation/plan/editPlan';
import { inspectMasksRun, inspectPlan } from '@mat/generation/plan/inspectPlan';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';
import { useRunSession } from '@mat/generation/ui/useRunSession';
import { createHarness, ENVIRONMENT, flush, preset } from '../run/runHarness';

afterEach(cleanup);

const noMaps: MapsState = { size: 1024, maps: {} };
const albedoOnly = (): GenerationPlan => ({ ...unassignMap(unassignMap(preset('preset-1'), 'normal'), 'height'), decomposition: null });
const settle = async (): Promise<void> => {
  await act(async () => {
    await flush();
  });
};

function mountSession(plan: GenerationPlan, beforeDecomposition: () => Promise<void>, withMasksRun = false) {
  const harness = createHarness();
  const masksPlan = preset('preset-3');
  const run = inspectMasksRun(masksPlan.decomposition!, ENVIRONMENT);
  const hook = renderHook(() =>
    useRunSession({
      ...(withMasksRun ? { masksRun: { plan: masksPlan, report: { cards: [run.card], problem: run.problem }, readAlbedoReference: vi.fn(async () => new Blob(['a'])) } } : {}),
      plan,
      report: inspectPlan(plan, ENVIRONMENT),
      planSummary: 'summary',
      prompt: 'Weathered red brick',
      colorMode: 'albedo',
      materialSize: 1024,
      references: [],
      mapsState: noMaps,
      ports: harness.ports,
      keys: { ensureUnlocked: vi.fn(async () => ({ ok: true as const, value: undefined })) },
      beforeDecomposition,
    }),
  );
  return { ...hook, harness };
}

describe('the run session asks before a metal-roughness run (masks-package R6)', () => {
  it('TestR6_a_plan_with_the_decomposition_waits_for_the_step_before_its_first_model_call', async () => {
    let release: () => void = () => {};
    const before = vi.fn(() => new Promise<void>((resolve) => { release = resolve; }));
    const { result, harness } = mountSession(preset('preset-3'), before);
    act(() => result.current.generate());
    await settle();
    expect(before).toHaveBeenCalledTimes(1);
    expect(harness.calls).toHaveLength(0);
    release();
    await settle();
    expect(harness.calls.length).toBeGreaterThan(0);
  });

  it('TestR6_the_masks_only_run_asks_too', async () => {
    const before = vi.fn(async () => undefined);
    const { result } = mountSession(albedoOnly(), before, true);
    act(() => result.current.generateMasks());
    await settle();
    expect(before).toHaveBeenCalledTimes(1);
  });

  it('TestR6_a_plan_without_the_decomposition_never_asks', async () => {
    const before = vi.fn(async () => undefined);
    const { result, harness } = mountSession(albedoOnly(), before);
    act(() => result.current.generate());
    await settle();
    expect(before).not.toHaveBeenCalled();
    expect(harness.calls).toHaveLength(1);
  });
});
