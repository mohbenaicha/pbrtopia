import type { GeneratedImage, ProviderError, Result } from '@shared/generation';
import type { PixelImage } from '@mat/maps';
import type { ColorModeName } from '../prompts/buildMapPrompt';
import { checkReturnedSize, splitReturnedImage } from '../split/splitReturnedImage';
import { buildImageCall, type ImageCall } from './buildImageCall';
import { describeLayout, mapDisplayName, mapKindOf } from './buildJobs';
import { describeRunOutcome } from './describeRunOutcome';
import type { DescribeAttempt, ImageAttempt, ImageJob, RunCheckpoint, RunFailure, RunPorts, RunProgress, RunReport } from './runTypes';
import type { GenerationPlan } from '../plan/planTypes';

export interface RunInput {
  jobs: readonly ImageJob[];
  plan: GenerationPlan;
  userText: string;
  colorMode: ColorModeName;
  references: readonly Blob[];
  materialSize: number | null; // S; null while the material has none (R40)
  resume: RunCheckpoint | null; // R56: a retry continues from the checkpoint and uses its plan, text, mode and references
  signal: AbortSignal;
  ports: RunPorts;
  onProgress?: (progress: RunProgress) => void;
}

const ABORTED = Symbol('aborted');

/** Resolves with the call's result, or ABORTED as soon as the signal fires, without waiting for the call (R43). */
function raceAbort<T>(call: Promise<T>, signal: AbortSignal): Promise<T | typeof ABORTED> {
  if (signal.aborted) return Promise.resolve(ABORTED);
  return new Promise((resolve, reject) => {
    const onAbort = (): void => resolve(ABORTED);
    signal.addEventListener('abort', onAbort, { once: true });
    call.then(
      (value) => {
        signal.removeEventListener('abort', onAbort);
        resolve(value);
      },
      (error: unknown) => {
        signal.removeEventListener('abort', onAbort);
        reject(error);
      },
    );
  });
}

const sizeText = (width: number, height: number): string => `${width} x ${height}`;

/**
 * Generation R6-R8, R40-R60: runs a plan. The lead (the image holding Albedo) first; when it is validated, split and committed, the other map images and the describe step
 * start together and the decomposition image starts as soon as the describe step has answered. With no lead the checkpoint already holds the existing Albedo as the albedo
 * reference and everything starts at once. Each image is committed as soon as it is split (R42); a failure keeps what was committed (R55);
 * Cancel drops every late result (R43, R44). The report carries the checkpoint a Retry continues from (R56).
 */
export async function runGeneration(input: RunInput): Promise<RunReport> {
  const { jobs, signal, ports } = input;
  const checkpoint: RunCheckpoint = input.resume
    ? { ...input.resume, finished: [...input.resume.finished] }
    : { plan: input.plan, userText: input.userText, colorMode: input.colorMode, references: [...input.references], finished: [], albedoReference: null, describe: null };
  const attempts: ImageAttempt[] = [];
  const failures: RunFailure[] = [];
  let describeAttempt: DescribeAttempt | null = null;
  let packed = false;

  const isFinished = (job: ImageJob): boolean => checkpoint.finished.includes(job.id);
  const reportProgress = (): void => input.onProgress?.({ finished: checkpoint.finished.length, total: jobs.length });
  const fail = (job: ImageJob | 'describe', message: string, category: string, retryable: boolean): void => {
    failures.push({ jobId: job === 'describe' ? 'describe' : job.id, message, retryable, category });
  };

  async function runImageJob(job: ImageJob): Promise<'done' | 'failed' | 'cancelled'> {
    if (signal.aborted) return 'cancelled';
    const describe = checkpoint.describe;
    const call: ImageCall = buildImageCall(job, {
      userText: checkpoint.userText,
      colorMode: checkpoint.colorMode,
      references: checkpoint.references,
      albedoReference: checkpoint.albedoReference,
      decompositionPrompt: job.kind === 'decomposition' && describe !== null ? ports.buildDecompositionPrompt(describe) : null,
    });
    const started = ports.now();
    const attempt: ImageAttempt = {
      jobId: job.id,
      label: job.label,
      maps: job.maps.map((map) => mapDisplayName(map, checkpoint.colorMode)),
      model: job.settings.modelId,
      resolutionKey: job.settings.resolutionKey,
      quality: job.settings.quality,
      canvas: sizeText(job.layout.canvas.width, job.layout.canvas.height),
      layout: describeLayout(job),
      tilePx: job.layout.tileSide,
      referenceNames: call.referenceNames,
      prompt: call.prompt,
      status: 'failed',
      durationMs: 0,
      mimeType: null,
      returnedSize: null,
      note: null,
      error: null,
      thumbnail: null,
    };
    const finish = (status: ImageAttempt['status'], error: string | null = null): void => {
      attempts.push({ ...attempt, status, error, durationMs: ports.now() - started });
    };

    let outcome: Result<GeneratedImage, ProviderError> | typeof ABORTED;
    try {
      outcome = await raceAbort(ports.generateImage(call.provider, call.request, signal), signal);
    } catch {
      outcome = { ok: false, error: { category: 'network-or-blocked', retryable: true, message: 'The request could not be completed.' } };
    }
    if (outcome === ABORTED || signal.aborted) return 'cancelled'; // a late result is written nowhere (R43)
    if (!outcome.ok) {
      const message = `${job.label}: ${outcome.error.message}`;
      finish('failed', message);
      fail(job, message, outcome.error.category, outcome.error.retryable);
      return 'failed';
    }
    attempt.mimeType = outcome.value.mimeType;
    if (outcome.value.mimeType === 'image/jpeg') attempt.note = 'JPEG source'; // R52
    const pixels: PixelImage | null = await ports.decodeImage(outcome.value.blob);
    if (signal.aborted) return 'cancelled';
    if (pixels === null) {
      const message = `${job.label}: the returned image could not be read.`;
      finish('failed', message);
      fail(job, message, 'validation', true);
      return 'failed';
    }
    attempt.returnedSize = sizeText(pixels.width, pixels.height);

    if (job.kind === 'decomposition') return acceptDecomposition(job, outcome.value.blob, pixels, finish);

    const split = splitReturnedImage(job.label, job.layout, pixels);
    if (!split.ok) {
      finish('failed', split.message);
      fail(job, split.message, 'validation', true);
      return 'failed';
    }
    const albedoAt = job.maps.indexOf('albedo');
    const reference = albedoAt >= 0 ? await ports.makeAlbedoReference(split.tiles[albedoAt]!) : null;
    if (signal.aborted) return 'cancelled';
    const stored = await ports.commitMaps(job.maps.map((map, index) => ({ kind: mapKindOf(map, checkpoint.colorMode), image: split.tiles[index]! })));
    if (signal.aborted) return 'cancelled';
    if (!stored) {
      const message = `${job.label}: the maps could not be stored.`;
      finish('failed', message);
      fail(job, message, 'storage', true);
      return 'failed';
    }
    if (reference !== null) checkpoint.albedoReference = reference;
    if (input.materialSize !== null && split.tiles[0]!.width < input.materialSize) attempt.note = [attempt.note, 'scaled up'].filter(Boolean).join(', ');
    if (job.maps.length >= 2) packed = true;
    checkpoint.finished.push(job.id);
    finish('done');
    reportProgress();
    return 'done';
  }

  async function acceptDecomposition(job: ImageJob, blob: Blob, pixels: PixelImage, finish: (status: ImageAttempt['status'], error?: string | null) => void): Promise<'done' | 'failed' | 'cancelled'> {
    const sizeProblem = checkReturnedSize(job.label, job.layout, pixels.width, pixels.height);
    if (sizeProblem !== null) {
      finish('failed', sizeProblem);
      fail(job, sizeProblem, 'validation', true);
      return 'failed';
    }
    const accepted = await raceAbort(ports.acceptDecomposition(blob, pixels, checkpoint.describe!, signal), signal);
    if (accepted === ABORTED || signal.aborted) return 'cancelled';
    if (!accepted.ok) {
      const message = `${job.label}: ${accepted.message}`;
      finish('failed', message);
      fail(job, message, 'validation', true);
      return 'failed';
    }
    checkpoint.finished.push(job.id);
    finish('done');
    reportProgress();
    return 'done';
  }

  async function runDescribeThenDecomposition(job: ImageJob): Promise<void> {
    if (checkpoint.describe === null) {
      const started = ports.now();
      const answered = await raceAbort(ports.describeAlbedo(checkpoint.albedoReference!, checkpoint.userText, signal), signal);
      if (answered === ABORTED || signal.aborted) return; // R44: an answer after Cancel is ignored and the decomposition is not started
      if (!answered.ok) {
        describeAttempt = { status: 'failed', durationMs: ports.now() - started, answerLength: null, error: `Describe step: ${answered.message}` };
        fail('describe', `Describe step: ${answered.message}`, 'validation', true);
        return; // R57: only the decomposition image is skipped
      }
      checkpoint.describe = answered.value;
      describeAttempt = { status: 'done', durationMs: ports.now() - started, answerLength: answered.value.components.length, error: null };
    }
    if (!isFinished(job)) await runImageJob(job);
  }

  const lead = jobs.find((job) => job.kind === 'map' && job.maps.includes('albedo')); // R6: the image holding Albedo; none when the albedo reference is the existing one
  const decomposition = jobs.find((job) => job.kind === 'decomposition');
  reportProgress();
  let leadReady = lead === undefined || isFinished(lead);
  if (lead !== undefined && !leadReady) leadReady = (await runImageJob(lead)) === 'done'; // R57: a failed lead stops the run before any other call
  if (leadReady) {
    const tasks: Array<Promise<unknown>> = jobs.filter((job) => job.kind === 'map' && job !== lead && !isFinished(job)).map((job) => runImageJob(job));
    if (decomposition !== undefined && (!isFinished(decomposition) || checkpoint.describe === null)) tasks.push(runDescribeThenDecomposition(decomposition));
    await Promise.all(tasks);
  }

  const keptNames = jobs
    .filter(isFinished)
    .flatMap((job) => (job.kind === 'decomposition' ? ['Metal-Roughness'] : job.maps.map((map) => mapDisplayName(map, checkpoint.colorMode))))
    .sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
  const { status, message } = describeRunOutcome({ aborted: signal.aborted, failureCount: failures.length, finishedImages: checkpoint.finished.length, totalImages: jobs.length, keptNames });
  return { status, message, committed: keptNames, failures, attempts, describeAttempt, checkpoint, packedWarning: packed };
}

const ORDER = ['Albedo', 'Diffuse', 'Normal', 'Height', 'Metal-Roughness'];
