import { describe, expect, it } from 'vitest';
import { assignMap } from '@mat/generation/plan/editPlan';
import type { GenerationPlan } from '@mat/generation/plan/planTypes';
import { runGeneration, type RunInput } from '@mat/generation/run/runGeneration';
import type { RunProgress, RunReport } from '@mat/generation/run/runTypes';
import { ANSWER, createHarness, fakeImage, flush, jobsOf, preset, providerError, type Harness } from './runHarness';

interface Started {
  harness: Harness;
  controller: AbortController;
  done: Promise<RunReport>;
  progress: RunProgress[];
}

function start(plan: GenerationPlan, patch: Partial<RunInput> = {}, harness: Harness = createHarness()): Started {
  const controller = new AbortController();
  const progress: RunProgress[] = [];
  const done = runGeneration({
    jobs: jobsOf(plan, patch.colorMode ?? 'albedo'),
    plan,
    userText: 'Weathered red brick',
    colorMode: 'albedo',
    references: [],
    materialSize: 1024,
    resume: null,
    signal: controller.signal,
    ports: harness.ports,
    onProgress: (value) => progress.push(value),
    ...patch,
  });
  return { harness, controller, done, progress };
}

describe('materialgen/generation R6 R7 R8 order and dependencies', () => {
  it('R7 given preset 3 and a finished lead, Normal, Height and the describe call are all in flight before the decomposition starts, and it starts without waiting for them', async () => {
    const run = start(preset('preset-3'));
    await flush();
    expect(run.harness.calls).toHaveLength(1); // Image 1 alone: nothing starts before what it needs is validated (R6)
    expect(run.harness.calls[0]!.provider).toBe('gemini');

    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.calls.map((call) => call.provider)).toEqual(['gemini', 'openai', 'openai']); // Normal and Height
    expect(run.harness.describeCalls).toHaveLength(1); // the describe step runs in parallel with them
    expect(run.harness.calls).toHaveLength(3); // no decomposition yet

    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(run.harness.calls).toHaveLength(4); // the decomposition image started while Normal and Height are still out
    expect(run.harness.calls[3]!.request.prompt).toContain('MASKS PROMPT');

    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    const report = await run.done;
    expect(report.status).toBe('done');
  });

  it('R7 R8 given the lead holds Albedo and Normal packed, no Normal call is made later; only Height, the describe step and the decomposition run', async () => {
    const plan = assignMap(preset('preset-1'), 'normal', 0);
    const run = start(plan);
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.calls).toHaveLength(2); // the lead and Height
    expect(run.harness.calls[1]!.request.prompt).toContain('height map');
    expect(run.harness.commits[0]!.map((map) => map.kind)).toEqual(['albedo', 'normal']);
    run.controller.abort();
    await run.done;
  });

  it('R6 the decomposition image needs the describe step: it is not requested while the step is unanswered', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    await flush();
    expect(run.harness.calls).toHaveLength(3);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(run.harness.calls).toHaveLength(4);
    run.harness.answerCanvas(run.harness.calls[3]!);
    expect((await run.done).status).toBe('done');
  });

  it('R15 a plan without the decomposition card makes no describe call', async () => {
    const run = start({ ...preset('preset-1'), decomposition: null });
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.describeCalls).toHaveLength(0);
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    expect((await run.done).message).toBe('Generated: Albedo, Normal, Height');
  });
});

describe('materialgen/generation R6 R7 R57 the existing Albedo and the lead on any image', () => {
  const existingAlbedo = new Blob(['existing-albedo'], { type: 'image/png' });
  const seeded = (plan: GenerationPlan, references: Blob[] = []): RunInput['resume'] => ({ plan, userText: '', colorMode: 'albedo', references, finished: [], albedoReference: existingAlbedo, describe: null });
  const noAlbedo = (): GenerationPlan => ({ ...preset('preset-2'), images: preset('preset-2').images.slice(1) }); // Image 1 = Normal, Image 2 = Height, Metal-Roughness card

  it('R7 given Normal and Height on separate images and the Metal-Roughness card, with an existing Albedo, the Normal call, the Height call and the describe call start together with the existing Albedo attached, and the decomposition starts when the describe call has answered', async () => {
    const plan = noAlbedo();
    const run = start(plan, { resume: seeded(plan) });
    await flush();
    expect(run.harness.calls).toHaveLength(2); // both map images at once, no lead to wait for
    expect(run.harness.describeCalls).toHaveLength(1);
    expect(run.harness.describeCalls[0]!.reference).toBe(existingAlbedo);
    for (const call of run.harness.calls) expect(call.request.images).toEqual([existingAlbedo]);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(run.harness.calls).toHaveLength(3);
    expect(run.harness.calls[2]!.request.prompt).toContain('MASKS PROMPT');
    for (const call of run.harness.calls) run.harness.answerCanvas(call);
    const report = await run.done;
    expect(report.status).toBe('done');
    expect(report.committed).toEqual(['Normal', 'Height', 'Metal-Roughness']);
    expect(run.harness.commits.flat().map((map) => map.kind)).not.toContain('albedo'); // Albedo is not touched
  });

  it('R7 given the Metal-Roughness card alone, the describe call runs on the existing Albedo and then the decomposition call; no map image is requested', async () => {
    const plan: GenerationPlan = { images: [], decomposition: preset('preset-2').decomposition };
    const run = start(plan, { resume: seeded(plan) });
    await flush();
    expect(run.harness.calls).toHaveLength(0);
    expect(run.harness.describeCalls).toHaveLength(1);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(run.harness.calls).toHaveLength(1);
    run.harness.answerCanvas(run.harness.calls[0]!);
    expect((await run.done).committed).toEqual(['Metal-Roughness']);
  });

  it('R7 R39 given the lead holds Albedo on Image 2, Image 2 runs first, takes the references, and Image 1 starts after it with the albedo reference', async () => {
    const swapped = assignMap(assignMap(preset('preset-1'), 'normal', 0), 'albedo', 1); // Image 1 = Normal, Image 2 = Albedo, Image 3 = Height
    const references = [new Blob(['photo'])];
    const run = start({ ...swapped, decomposition: null }, { references });
    await flush();
    expect(run.harness.calls).toHaveLength(1);
    expect(run.harness.calls[0]!.request.prompt).toContain('albedo');
    expect(run.harness.calls[0]!.request.images).toEqual(references);
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.calls).toHaveLength(3); // Image 1 (Normal) and Image 3 (Height)
    for (const call of run.harness.calls.slice(1)) {
      expect(call.request.images).toHaveLength(1);
      expect(call.request.images).not.toEqual(references);
    }
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    expect((await run.done).committed).toEqual(['Albedo', 'Normal', 'Height']);
  });

  it('R39 with no Albedo in the plan the user\'s references are not sent to any call', async () => {
    const plan = noAlbedo();
    const photo = new Blob(['photo']);
    const run = start(plan, { resume: seeded(plan, [photo]), references: [photo] });
    await flush();
    for (const call of run.harness.calls) expect(call.request.images).toEqual([existingAlbedo]);
    run.controller.abort();
    await run.done;
  });

  it('R57 with no lead a failed image does not stop the others; the run ends partial and Retry keeps the existing Albedo in the checkpoint', async () => {
    const plan = noAlbedo();
    const run = start(plan, { resume: seeded(plan) });
    await flush();
    run.harness.calls[0]!.settle({ ok: false, error: providerError('quota') });
    run.harness.answerCanvas(run.harness.calls[1]!);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    run.harness.answerCanvas(run.harness.calls[2]!);
    const report = await run.done;
    expect(report.failures.map((failure) => failure.jobId)).toEqual(['image-1']);
    expect(report.committed).toEqual(['Height', 'Metal-Roughness']);
    expect(report.checkpoint.albedoReference).toBe(existingAlbedo);
  });
});

describe('materialgen/generation R39 R31 what each call sends', () => {
  it('R39 with no reference image, Image 1 is a text-to-image request; every other image gets only the albedo reference', async () => {
    const run = start(preset('preset-1'));
    await flush();
    expect(run.harness.calls[0]!.request.images).toEqual([]);
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    for (const call of run.harness.calls.slice(1)) {
      expect(call.request.images).toHaveLength(1);
      expect(call.request.references).toEqual([]);
    }
    run.controller.abort();
    await run.done;
  });

  it('R39 the user\'s references go with Image 1 only', async () => {
    const references = [new Blob(['a']), new Blob(['b'])];
    const run = start(preset('preset-1'), { references });
    await flush();
    expect(run.harness.calls[0]!.request.images).toEqual(references);
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.calls[1]!.request.images).not.toContain(references[0]);
    run.controller.abort();
    await run.done;
  });

  it('R22 each call sends its layout canvas, model, resolution and quality', async () => {
    const run = start(preset('preset-3'));
    await flush();
    const request = run.harness.calls[0]!.request;
    expect(request.model).toBe('gemini-nano-banana-2.1');
    expect(request.resolutionKey).toBe('1K');
    expect(request.canvas).toEqual({ width: 1024, height: 1024 });
    expect(request.quality).toBe('minimal');
    run.controller.abort();
    await run.done;
  });

  it('R68 the attempt records the prompt exactly as sent, with layout, canvas and tile size', async () => {
    const run = start(preset('preset-1'));
    await flush();
    const sent = run.harness.calls[0]!.request.prompt;
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    const report = await run.done;
    const lead = report.attempts.find((attempt) => attempt.jobId === 'image-1')!;
    expect(lead.prompt).toBe(sent);
    expect(lead).toMatchObject({ canvas: '1024 x 1024', layout: '1x1', tilePx: 1024, status: 'done', mimeType: 'image/jpeg', returnedSize: '1024 x 1024' });
  });

  it('R52 a Gemini image is noted as a JPEG source in the log', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    expect((await run.done).attempts[0]!.note).toBe('JPEG source');
  });
});

describe('materialgen/generation R40 R41 R42 committing as it goes', () => {
  it('R42 each image is committed when it is split, Albedo first as the new original, and the lead reference is kept in the checkpoint', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.commits).toHaveLength(1);
    expect(run.harness.commits[0]!.map((map) => map.kind)).toEqual(['albedo']);
    run.harness.answerCanvas(run.harness.calls[1]!);
    await flush();
    expect(run.harness.commits.map((commit) => commit.map((map) => map.kind))).toEqual([['albedo'], ['normal']]);
    run.controller.abort();
    const report = await run.done;
    expect(report.checkpoint.albedoReference).not.toBeNull();
    expect(report.checkpoint.finished).toEqual(['image-1', 'image-2']);
  });

  it('R32 in the Diffuse colour mode the colour map is committed as diffuse', async () => {
    const run = start(preset('preset-1'), { colorMode: 'diffuse' });
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    expect(run.harness.commits[0]![0]!.kind).toBe('diffuse');
    run.controller.abort();
    await run.done;
  });

  it('R41 progress counts the finished images out of all of them, the decomposition image included', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    await run.done;
    expect(run.progress[0]).toEqual({ finished: 0, total: 4 });
    expect(run.progress.at(-1)).toEqual({ finished: 1, total: 4 });
  });

  it('R40 a tile smaller than S is noted as scaled up', async () => {
    const run = start(preset('preset-1'), { materialSize: 2048 });
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    expect((await run.done).attempts[0]!.note).toContain('scaled up');
  });

  it('R50 a run that cut a packed image says so', async () => {
    const run = start(assignMap(preset('preset-1'), 'normal', 0));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    expect((await run.done).packedWarning).toBe(true);
  });
});

describe('materialgen/generation R43 R44 cancel', () => {
  it('R43 Cancel resolves at once, waits for no request, and a late image is written nowhere', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    const report = await run.done; // the follower calls were never answered
    expect(report.status).toBe('cancelled');
    expect(report.message).toBe('Cancelled. Kept: Albedo.');
    const commitsBefore = run.harness.commits.length;
    run.harness.answerCanvas(run.harness.calls[1]!); // arrives after Cancel
    await flush();
    expect(run.harness.commits).toHaveLength(commitsBefore);
    expect(report.checkpoint.finished).toEqual(['image-1']);
  });

  it('R43 Cancel before anything is kept says only Cancelled.', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.controller.abort();
    expect((await run.done).message).toBe('Cancelled.');
  });

  it('R44 given Cancel while the describe step is in flight, its late answer is ignored and the decomposition image is not started', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.controller.abort();
    await run.done;
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(run.harness.calls.some((call) => call.request.prompt.includes('MASKS PROMPT'))).toBe(false);
  });

  it('R43 an already cancelled run makes no call at all', async () => {
    const controller = new AbortController();
    controller.abort();
    const harness = createHarness();
    const report = await runGeneration({ jobs: jobsOf(preset('preset-1')), plan: preset('preset-1'), userText: '', colorMode: 'albedo', references: [], materialSize: null, resume: null, signal: controller.signal, ports: harness.ports });
    expect(harness.calls).toHaveLength(0);
    expect(report.status).toBe('cancelled');
  });
});

describe('materialgen/generation R47 R52 R53 R54 validation failures', () => {
  it('R52 R53 given GPT returns 1024x1024 for a 2:1 canvas, the image fails with a retryable validation error naming it and none of its maps is committed', async () => {
    const plan = assignMap(preset('preset-2'), 'normal', 0);
    const run = start(plan);
    await flush();
    const lead = run.harness.calls[0]!;
    expect(lead.request.canvas!.width).toBeGreaterThan(lead.request.canvas!.height); // a wide canvas for two maps
    lead.settle({ ok: true, value: fakeImage(1024, 1024) });
    const report = await run.done;
    expect(report.failures).toEqual([{ jobId: 'image-1', message: expect.stringContaining('Image 1 (Albedo, Normal): the returned image is not') as string, retryable: true, category: 'validation' }]);
    expect(run.harness.commits).toHaveLength(0);
  });

  it('R47 an image the decoder cannot read fails the same way', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.calls[0]!.settle({ ok: true, value: { blob: new Blob(['junk']), mimeType: 'image/png' } });
    const report = await run.done;
    expect(report.failures[0]).toMatchObject({ jobId: 'image-1', category: 'validation' });
    expect(report.failures[0]!.message).toBe('Image 1 (Albedo): the returned image could not be read.');
  });

  it('R51 R14 the decomposition image is handed over whole, at its own size, to the masks steps', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    run.harness.calls[3]!.settle({ ok: true, value: fakeImage(1024, 1024) });
    for (const call of run.harness.calls.slice(1, 3)) run.harness.answerCanvas(call);
    await run.done;
    expect(run.harness.decompositions).toHaveLength(1);
    expect(run.harness.decompositions[0]!.pixels.width).toBe(1024);
  });

  it('R58 given the decomposition was refused by the masks steps, the other maps stay and the failure is named', async () => {
    const harness = createHarness({ acceptDecomposition: { ok: false, message: 'covers only 20% of the albedo' } });
    const run = start(preset('preset-1'), {}, harness);
    await flush();
    harness.answerCanvas(harness.calls[0]!);
    await flush();
    harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    for (const call of harness.calls.slice(1)) harness.answerCanvas(call);
    const report = await run.done;
    expect(report.status).toBe('partial');
    expect(report.committed).toEqual(['Albedo', 'Normal', 'Height']);
    expect(report.failures[0]!.message).toBe('Metal-Roughness image: covers only 20% of the albedo');
  });
});

describe('materialgen/generation R54 R55 R57 R60 errors and partial success', () => {
  it('R57 a failed lead stops the run before any other call starts and commits nothing', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.calls[0]!.settle({ ok: false, error: providerError('quota') });
    const report = await run.done;
    expect(run.harness.calls).toHaveLength(1);
    expect(run.harness.describeCalls).toHaveLength(0);
    expect(report.status).toBe('failed');
    expect(report.failures[0]).toEqual({ jobId: 'image-1', message: 'Image 1 (Albedo): Quota used up.', retryable: true, category: 'quota' });
    expect(run.harness.commits).toHaveLength(0);
  });

  it('R57 R55 a failed follower lets the running images finish and keeps what was committed', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.calls[1]!.settle({ ok: false, error: providerError('moderation', false) });
    run.harness.answerCanvas(run.harness.calls[2]!);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    run.harness.answerCanvas(run.harness.calls[3]!);
    const report = await run.done;
    expect(report.status).toBe('partial');
    expect(report.message).toBe('Generated 3 of 4 images');
    expect(report.committed).toEqual(['Albedo', 'Height', 'Metal-Roughness']);
    expect(report.failures.map((failure) => failure.message)).toEqual(['Image 2 (Normal): Something went wrong.']);
  });

  it('R57 R54 a failed describe step lets the map images finish, skips the decomposition image only, and names the step', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.settleDescribe({ ok: false, message: 'the answer held no components' });
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    const report = await run.done;
    expect(run.harness.calls).toHaveLength(3);
    expect(report.failures).toEqual([{ jobId: 'describe', message: 'Describe step: the answer held no components', retryable: true, category: 'validation' }]);
    expect(report.describeAttempt?.status).toBe('failed');
    expect(report.committed).toEqual(['Albedo', 'Normal', 'Height']);
  });

  it('R55 a commit the maps module refused fails that image and is reported', async () => {
    const run = start(preset('preset-1'), {}, createHarness({ commitOk: false }));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    const report = await run.done;
    expect(report.failures[0]).toMatchObject({ jobId: 'image-1', category: 'storage' });
  });

  it('R60 a run in which every image succeeded ends with one line naming the maps', async () => {
    const run = start(preset('preset-2'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    const report = await run.done;
    expect(report.message).toBe('Generated: Albedo, Normal, Height, Metal-Roughness');
    expect(report.status).toBe('done');
  });
});

describe('materialgen/generation R56 R59 retry', () => {
  async function failImage2(): Promise<{ report: RunReport; harness: Harness }> {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.calls[1]!.settle({ ok: false, error: providerError('timeout') });
    run.harness.answerCanvas(run.harness.calls[2]!);
    run.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    run.harness.answerCanvas(run.harness.calls[3]!);
    return { report: await run.done, harness: run.harness };
  }

  it('R59 given Image 2 failed, Retry requests only Image 2, with the same prompt and the kept albedo reference, and a success ends the run', async () => {
    const { report, harness: first } = await failImage2();
    const sentBefore = first.calls[1]!.request.prompt;
    const retry = start(preset('preset-1'), { resume: report.checkpoint, userText: 'IGNORED NEW TEXT', colorMode: 'diffuse' });
    await flush();
    expect(retry.harness.calls).toHaveLength(1);
    expect(retry.harness.calls[0]!.request.prompt).toBe(sentBefore); // the checkpoint's text and mode, not the panel's now (R56)
    expect(retry.harness.calls[0]!.request.images).toEqual([report.checkpoint.albedoReference]);
    expect(retry.harness.describeCalls).toHaveLength(0); // the describe answer is kept
    retry.harness.answerCanvas(retry.harness.calls[0]!);
    const done = await retry.done;
    expect(done.status).toBe('done');
    expect(done.message).toBe('Generated: Albedo, Normal, Height, Metal-Roughness');
    expect(retry.harness.commits.map((commit) => commit.map((map) => map.kind))).toEqual([['normal']]);
  });

  it('R59 given the lead failed, Retry reruns the lead with the same prompt and references', async () => {
    const references = [new Blob(['ref'])];
    const run = start(preset('preset-1'), { references });
    await flush();
    const sent = run.harness.calls[0]!.request.prompt;
    run.harness.calls[0]!.settle({ ok: false, error: providerError('network-or-blocked') });
    const failed = await run.done;
    const retry = start(preset('preset-1'), { resume: failed.checkpoint, references: [] });
    await flush();
    expect(retry.harness.calls[0]!.request.prompt).toBe(sent);
    expect(retry.harness.calls[0]!.request.images).toEqual(references);
    retry.controller.abort();
    await retry.done;
  });

  it('R56 a retry after a failed describe step asks the describe step again, then the decomposition image', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.answerCanvas(run.harness.calls[0]!);
    await flush();
    run.harness.settleDescribe({ ok: false, message: 'bad' });
    for (const call of run.harness.calls.slice(1)) run.harness.answerCanvas(call);
    const first = await run.done;
    const retry = start(preset('preset-1'), { resume: first.checkpoint });
    await flush();
    expect(retry.harness.calls).toHaveLength(0); // no map image is requested again
    expect(retry.harness.describeCalls).toHaveLength(1);
    retry.harness.settleDescribe({ ok: true, value: ANSWER });
    await flush();
    expect(retry.harness.calls).toHaveLength(1);
    retry.controller.abort();
    await retry.done;
  });
});

describe('materialgen/generation R69 attempts', () => {
  it('R69 an attempt is kept for the failed run and another for its retry, each with its prompt', async () => {
    const run = start(preset('preset-1'));
    await flush();
    run.harness.calls[0]!.settle({ ok: false, error: providerError('server') });
    const first = await run.done;
    const retry: Started = start(preset('preset-1'), { resume: first.checkpoint });
    await flush();
    retry.harness.answerCanvas(retry.harness.calls[0]!);
    await flush();
    retry.controller.abort();
    const second = await retry.done;
    expect(first.attempts[0]!.status).toBe('failed');
    expect(second.attempts[0]!.status).toBe('done');
    expect(first.attempts[0]!.prompt).toBe(second.attempts[0]!.prompt);
  });
});
