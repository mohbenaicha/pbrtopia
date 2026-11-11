// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapRecord, MapsState } from '@mat/maps';
import { unassignMap } from '@mat/generation/plan/editPlan';
import { inspectMasksRun, inspectPlan } from '@mat/generation/plan/inspectPlan';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';
import { useRunSession } from '@mat/generation/ui/useRunSession';
import { ANSWER, createHarness, ENVIRONMENT, flush, providerError, preset, type Harness } from '../run/runHarness';

afterEach(cleanup);

const albedoOnly = (): GenerationPlan => ({ ...unassignMap(unassignMap(preset('preset-1'), 'normal'), 'height'), decomposition: null });
const record: MapRecord = { originalKey: 'o', workingKey: 'w', undoKey: null, width: 1024, height: 1024 };
const noMaps: MapsState = { size: 1024, maps: {} };
const keysOk = () => ({ ensureUnlocked: vi.fn(async () => ({ ok: true as const, value: undefined })) });

const withDecomposition = (): GenerationPlan => preset('preset-3');
const masksRunOf = (albedo: Blob | null) => {
  const plan = withDecomposition();
  const run = inspectMasksRun(plan.decomposition!, ENVIRONMENT);
  return { plan, report: { cards: [run.card], problem: run.problem }, readAlbedoReference: vi.fn(async () => albedo) };
};

const existingAlbedoOf = (albedo: Blob | null) => vi.fn(async () => albedo);

function mountSession(
  options: { plan?: GenerationPlan; maps?: MapsState; keys?: ReturnType<typeof keysOk>; harness?: Harness; masksRun?: ReturnType<typeof masksRunOf>; existingAlbedo?: ReturnType<typeof existingAlbedoOf> } = {},
) {
  const plan = options.plan ?? albedoOnly();
  const harness = options.harness ?? createHarness();
  const keys = options.keys ?? keysOk();
  const hook = renderHook(() =>
    useRunSession({
      ...(options.masksRun === undefined ? {} : { masksRun: options.masksRun }),
      ...(options.existingAlbedo === undefined ? {} : { readAlbedoReference: options.existingAlbedo }),
      plan,
      report: inspectPlan(plan, ENVIRONMENT),
      planSummary: '1 image - maps 1024 px',
      prompt: 'Weathered red brick',
      colorMode: 'albedo',
      materialSize: 1024,
      references: [],
      mapsState: options.maps ?? noMaps,
      ports: harness.ports,
      keys,
    }),
  );
  return { ...hook, harness, keys };
}

const settle = async (): Promise<void> => {
  await act(async () => {
    await flush();
  });
};

describe('materialgen/generation run session', () => {
  it('R6 R43 a first generation starts at once, shows progress, and Cancel ends the run without an error panel or a retry', async () => {
    const { result, harness } = mountSession();
    act(() => result.current.generate());
    await settle();
    expect(result.current.running).toBe(true);
    expect(harness.calls).toHaveLength(1);
    act(() => result.current.cancel());
    await settle();
    expect(result.current.running).toBe(false);
    expect(result.current.canRetry).toBe(false);
    expect(result.current.result?.failures ?? []).toEqual([]);
  });

  it('R61 when an original would be replaced a warning opens first; Cancel starts nothing and Generate then starts the run', async () => {
    const { result, harness, keys } = mountSession({ maps: { size: 1024, maps: { albedo: record } } });
    act(() => result.current.generate());
    await settle();
    expect(result.current.confirm?.warning).toBe('Generating replaces the originals of Albedo and clears the undo of those maps. Maps you edited are replaced too.');
    expect(harness.calls).toHaveLength(0);
    act(() => result.current.dismissConfirm());
    expect(result.current.confirm).toBeNull();
    expect(keys.ensureUnlocked).not.toHaveBeenCalled();
    act(() => result.current.generate());
    act(() => result.current.confirmGenerate());
    await settle();
    expect(result.current.running).toBe(true);
    expect(harness.calls).toHaveLength(1);
  });

  it('R65 cancelling the password prompt starts no call and shows no error; another unlock failure is reported', async () => {
    const cancelled = { ensureUnlocked: vi.fn(async () => ({ ok: false as const, error: { code: 'password-cancelled', message: 'Cancelled.' } })) };
    const first = mountSession({ keys: cancelled as never });
    act(() => first.result.current.generate());
    await settle();
    expect(first.harness.calls).toHaveLength(0);
    expect(first.result.current.startError).toBeNull();
    expect(first.result.current.running).toBe(false);

    const wrong = { ensureUnlocked: vi.fn(async () => ({ ok: false as const, error: { code: 'wrong-password', message: 'That password is wrong.' } })) };
    const second = mountSession({ keys: wrong as never });
    act(() => second.result.current.generate());
    await settle();
    expect(second.result.current.startError).toBe('That password is wrong.');
    expect(second.harness.calls).toHaveLength(0);
  });

  it('R6 R43 a second Generate while the password prompt is open starts nothing more, and leaving the project then starts no call', async () => {
    let unlock: (value: { ok: true; value: undefined }) => void = () => undefined;
    const pending = { ensureUnlocked: vi.fn(() => new Promise<{ ok: true; value: undefined }>((resolve) => { unlock = resolve; })) };
    const { result, harness, unmount } = mountSession({ keys: pending as never });
    act(() => result.current.generate());
    act(() => result.current.generate());
    expect(pending.ensureUnlocked).toHaveBeenCalledTimes(1);
    unmount();
    await act(async () => {
      unlock({ ok: true, value: undefined });
      await flush();
    });
    expect(harness.calls).toHaveLength(0);
  });

  it('R6 R43 a step that throws ends the run with a line instead of leaving Generate locked', async () => {
    const { result, harness } = mountSession();
    vi.spyOn(harness.ports, 'decodeImage').mockRejectedValue(new Error('boom'));
    act(() => result.current.generate());
    await settle();
    act(() => harness.answerCanvas(harness.calls[0]!));
    await settle();
    expect(result.current.running).toBe(false);
    expect(result.current.startError).toBe('The run stopped unexpectedly. Check the maps, then press Generate again.');
  });

  it('R60 R68 a finished run says what it generated and becomes the newest log row', async () => {
    const { result, harness } = mountSession();
    act(() => result.current.generate());
    await settle();
    act(() => harness.answerCanvas(harness.calls[0]!));
    await settle();
    expect(result.current.running).toBe(false);
    expect(result.current.result?.message).toBe('Generated: Albedo');
    expect(result.current.log).toHaveLength(1);
    expect(result.current.log[0]).toMatchObject({ userText: 'Weathered red brick', planSummary: '1 image - maps 1024 px', status: 'done' });
    expect(result.current.log[0]!.attempts[0]!.prompt).toContain('Material: Weathered red brick');
  });

  it('R68 only the last ten runs are kept', async () => {
    const { result, harness } = mountSession();
    for (let run = 1; run <= 11; run += 1) {
      act(() => result.current.generate());
      await settle();
      act(() => harness.answerCanvas(harness.calls[run - 1]!));
      await settle();
    }
    expect(result.current.log).toHaveLength(10);
  });

  it('R56 R69 Retry runs the failed image again and the log row keeps both attempts', async () => {
    const { result, harness } = mountSession();
    act(() => result.current.generate());
    await settle();
    act(() => harness.calls[0]!.settle({ ok: false, error: providerError('server') }));
    await settle();
    expect(result.current.canRetry).toBe(true);
    expect(result.current.result?.status).toBe('failed');

    act(() => result.current.retry());
    await settle();
    expect(harness.calls).toHaveLength(2);
    expect(harness.calls[1]!.request.prompt).toBe(harness.calls[0]!.request.prompt);
    act(() => harness.answerCanvas(harness.calls[1]!));
    await settle();
    expect(result.current.log).toHaveLength(1);
    expect(result.current.log[0]!.attempts.map((attempt) => attempt.status)).toEqual(['failed', 'done']);
    expect(result.current.canRetry).toBe(false);
  });
});

describe('materialgen/generation R6 R7 R9 R56 a plan with no Albedo works from the existing Albedo', () => {
  const albedo = new Blob(['existing-albedo'], { type: 'image/png' });
  const normalHeight = (): GenerationPlan => ({ ...unassignMap(preset('preset-2'), 'albedo'), decomposition: null });

  it('R6 R7 Generate reads the existing Albedo once, attaches it to every map image at once, and the plan\'s own Albedo is never asked for', async () => {
    const read = existingAlbedoOf(albedo);
    const { result, harness } = mountSession({ plan: normalHeight(), existingAlbedo: read, maps: { size: 1024, maps: { albedo: record } } });
    act(() => result.current.generate());
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(harness.calls).toHaveLength(2);
    for (const call of harness.calls) expect(call.request.images).toEqual([albedo]);
  });

  it('R9 a plan with no Albedo in a project with none starts nothing and says what is missing', async () => {
    const { result, harness } = mountSession({ plan: normalHeight(), existingAlbedo: existingAlbedoOf(null) });
    act(() => result.current.generate());
    await settle();
    expect(harness.calls).toHaveLength(0);
    expect(result.current.startError).toBe('Normal, Height and Metal-Roughness need an Albedo: generate one or drop one in.');
    expect(result.current.running).toBe(false);
  });

  it('R56 Retry reuses the existing Albedo the run began with, without reading it again', async () => {
    const read = existingAlbedoOf(albedo);
    const { result, harness } = mountSession({ plan: normalHeight(), existingAlbedo: read });
    act(() => result.current.generate());
    await settle();
    act(() => harness.calls[0]!.settle({ ok: false, error: providerError('quota') }));
    act(() => harness.answerCanvas(harness.calls[1]!));
    await settle();
    expect(result.current.canRetry).toBe(true);
    act(() => result.current.retry());
    await settle();
    expect(read).toHaveBeenCalledTimes(1);
    expect(harness.calls).toHaveLength(3);
    expect(harness.calls[2]!.request.images).toEqual([albedo]);
  });
});

describe('materialgen/masks R64 R65 R68 the masks-only run', () => {
  const albedo = new Blob(['albedo'], { type: 'image/png' });

  it('R64 Create masks describes the current albedo, asks for the decomposition image alone, and hands the picture over', async () => {
    const masksRun = masksRunOf(albedo);
    const { result, harness } = mountSession({ masksRun });
    act(() => result.current.generateMasks());
    await settle();
    expect(harness.describeCalls).toHaveLength(1);
    expect(harness.describeCalls[0]!.reference).toBe(albedo);
    act(() => harness.settleDescribe({ ok: true, value: ANSWER }));
    await settle();
    expect(harness.calls).toHaveLength(1); // no map image is asked for
    expect(harness.calls[0]!.request.prompt).toContain('MASKS PROMPT');
    act(() => harness.answerCanvas(harness.calls[0]!));
    await settle();
    expect(harness.decompositions).toHaveLength(1);
    expect(harness.commits).toHaveLength(0); // the maps are untouched
    expect(result.current.result?.status).toBe('done');
  });

  it('R64 the session says which kind of run is going or was last: the plan or the masks alone', async () => {
    const { result, harness } = mountSession({ masksRun: masksRunOf(albedo) });
    expect(result.current.runKind).toBeNull();
    act(() => result.current.generateMasks());
    await settle();
    expect(result.current.runKind).toBe('masks');
    act(() => harness.settleDescribe({ ok: false, message: 'refused' }));
    await settle();
    expect(result.current.runKind).toBe('masks');
    act(() => result.current.generate());
    await settle();
    expect(result.current.runKind).toBe('plan');
  });

  it('R64 a material with no albedo to describe starts nothing and says so', async () => {
    const { result, harness } = mountSession({ masksRun: masksRunOf(null) });
    act(() => result.current.generateMasks());
    await settle();
    expect(harness.describeCalls).toHaveLength(0);
    expect(result.current.startError).toBe('Masks need an albedo map.');
    expect(result.current.running).toBe(false);
  });

  it('R65 after the picture fails, Retry repeats only the image: the described components are kept', async () => {
    const { result, harness } = mountSession({ masksRun: masksRunOf(albedo) });
    act(() => result.current.generateMasks());
    await settle();
    act(() => harness.settleDescribe({ ok: true, value: ANSWER }));
    await settle();
    act(() => harness.calls[0]!.settle({ ok: false, error: providerError('server') }));
    await settle();
    expect(result.current.canRetry).toBe(true);
    act(() => result.current.retry());
    await settle();
    expect(harness.describeCalls).toHaveLength(1);
    expect(harness.calls).toHaveLength(2);
    act(() => harness.answerCanvas(harness.calls[1]!));
    await settle();
    expect(harness.decompositions).toHaveLength(1);
    expect(result.current.canRetry).toBe(false);
  });

  it('R68 Cancel during the describe call writes nothing and shows no error', async () => {
    const { result, harness } = mountSession({ masksRun: masksRunOf(albedo) });
    act(() => result.current.generateMasks());
    await settle();
    act(() => result.current.cancel());
    act(() => harness.settleDescribe({ ok: true, value: ANSWER }));
    await settle();
    expect(harness.calls).toHaveLength(0);
    expect(result.current.running).toBe(false);
    expect(result.current.result?.failures ?? []).toEqual([]);
  });
});
