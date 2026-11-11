import { useCallback, useEffect, useRef, useState } from 'react';
import type { KeyVault } from '@shared/keys';
import type { MapsState } from '@mat/maps';
import { NEEDS_ALBEDO_PROBLEM, type PlanReport } from '../plan/inspectPlan';
import type { GenerationPlan } from '../plan/planTypes';
import type { ColorModeName } from '../prompts/buildMapPrompt';
import { buildJobs } from '../run/buildJobs';
import { describeRegenerateWarning, listMapsToReplace } from '../run/describeRegenerate';
import { recordRetry, recordRun, type RunLogRow } from '../run/runLogHistory';
import { runGeneration } from '../run/runGeneration';
import type { RunPorts, RunProgress, RunReport } from '../run/runTypes';
import { useLeaveWarning } from './useLeaveWarning';

export interface RegenerateConfirm {
  warning: string; // R61
}

export interface RunSession {
  running: boolean;
  progress: RunProgress | null;
  result: RunReport | null; // the last finished run, for the line and the error panel (R55, R60)
  startError: string | null; // a vault that could not be unlocked (R65); cancelling the password prompt is not an error
  confirm: RegenerateConfirm | null;
  canRetry: boolean;
  log: RunLogRow[];
  generate(): void; // R61: asks first when originals would be replaced
  confirmGenerate(): void;
  dismissConfirm(): void;
  cancel(): void; // R43
  retry(): void; // R56
  generateMasks(): void; // masks R64: the describe step and the decomposition image alone, from the albedo the material has now
  runKind: RunMode | null; // the kind of the latest attempt (going, or the last one); null before the first
  resultKind: RunMode | null; // the kind of the run `result` belongs to
}

/** What the masks-only run needs besides the plan's own run: its plan and report (the decomposition card alone) and the current albedo as a reference. */
export interface MasksRunInputs {
  plan: GenerationPlan;
  report: PlanReport;
  readAlbedoReference(): Promise<Blob | null>;
}

export type RunMode = 'plan' | 'masks';
const NO_ALBEDO = 'Masks need an albedo map.';
const MASKS_SUMMARY = 'Metal-Roughness image only';

interface Inputs {
  plan: GenerationPlan;
  report: PlanReport;
  planSummary: string; // the hint's first line, kept in the log row (R68)
  prompt: string;
  colorMode: ColorModeName;
  materialSize: number | null;
  references: readonly Blob[];
  mapsState: MapsState;
  ports: RunPorts;
  keys: Pick<KeyVault, 'ensureUnlocked'>;
  masksRun?: MasksRunInputs;
  readAlbedoReference?: () => Promise<Blob | null>; // R6: the existing Albedo as the albedo reference of a plan that holds no Albedo; null when the project has none
}

/** Generation R6-R8, R43, R55-R57, R60, R61, R65, R68: runs the plan, with Cancel and Retry, and keeps the last ten runs in memory. */
export function useRunSession(inputs: Inputs): RunSession {
  const latest = useRef(inputs);
  latest.current = inputs;
  const [running, setRunning] = useState(false);
  useLeaveWarning(running); // R76
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [result, setResult] = useState<RunReport | null>(null);
  const [runKind, setRunKind] = useState<RunMode | null>(null);
  const [resultKind, setResultKind] = useState<RunMode | null>(null);
  const [startError, setStartError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<RegenerateConfirm | null>(null);
  const [log, setLog] = useState<RunLogRow[]>([]);
  const resultRef = useRef<RunReport | null>(null);
  resultRef.current = result;
  const abort = useRef<AbortController | null>(null);
  const starting = useRef(false); // set at once, before the password prompt, so a second click cannot start a second paid run
  const mounted = useRef(true);
  const lastRow = useRef<string | null>(null);
  const lastRun = useRef<{ report: PlanReport; materialSize: number | null; mode: RunMode } | null>(null); // R56: a retry keeps the jobs, size and kind of the failed run
  const counter = useRef(0);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
      abort.current?.abort(); // leaving the project ends the run
    };
  }, []);

  const start = useCallback(async (resume: RunReport | null, requested: RunMode = 'plan') => {
    if (starting.current) return;
    starting.current = true;
    setStartError(null);
    setRunKind(resume !== null ? (lastRun.current?.mode ?? requested) : requested); // the kind of the latest attempt, so a start error is told apart
    try {
      const unlocked = await latest.current.keys.ensureUnlocked();
      if (!unlocked.ok) {
        if (unlocked.error.code !== 'password-cancelled') setStartError(unlocked.error.message);
        return;
      }
      if (!mounted.current) return; // the project was left while the password prompt was open
      const current = latest.current; // read after the prompt: edits made meanwhile count
      const retained = resume !== null ? lastRun.current : null;
      const mode = retained?.mode ?? requested;
      const masksRun = current.masksRun;
      if (mode === 'masks' && masksRun === undefined) return;
      const report = retained?.report ?? (mode === 'masks' ? masksRun!.report : current.report);
      const materialSize = retained !== null ? retained.materialSize : current.materialSize;
      let checkpoint = resume?.checkpoint ?? null;
      if (mode === 'masks' && checkpoint === null) {
        const albedoReference = await masksRun!.readAlbedoReference(); // masks R64: the albedo the material has now
        if (!mounted.current) return;
        if (albedoReference === null) {
          setStartError(NO_ALBEDO);
          return;
        }
        checkpoint = { plan: masksRun!.plan, userText: current.prompt, colorMode: current.colorMode, references: [], finished: [], albedoReference, describe: null };
      }
      if (mode === 'plan' && checkpoint === null && !current.plan.images.some((image) => image.maps.includes('albedo'))) {
        const albedoReference = (await current.readAlbedoReference?.()) ?? null; // R6: no lead, so the existing Albedo is read now and kept for Retry (R56)
        if (!mounted.current) return;
        if (albedoReference === null) {
          setStartError(NEEDS_ALBEDO_PROBLEM);
          return;
        }
        checkpoint = { plan: current.plan, userText: current.prompt, colorMode: current.colorMode, references: [...current.references], finished: [], albedoReference, describe: null };
      }
      const plan = checkpoint?.plan ?? current.plan;
      const prompt = checkpoint?.userText ?? current.prompt;
      const colorMode = checkpoint?.colorMode ?? current.colorMode;
      const references = checkpoint?.references ?? current.references;
      lastRun.current = { report, materialSize, mode };
      const controller = new AbortController();
      abort.current = controller;
      setRunning(true);
      setProgress({ finished: 0, total: 0 });
      const startedAt = current.ports.now();
      try {
        const finished = await runGeneration({
          jobs: buildJobs(report, colorMode),
          plan,
          userText: prompt,
          colorMode,
          references,
          materialSize,
          resume: checkpoint,
          signal: controller.signal,
          ports: current.ports,
          onProgress: setProgress,
        });
        if (!mounted.current) return;
        if (finished.status === 'cancelled' && finished.committed.length === 0 && finished.attempts.length === 0) return; // R43: the panel is as it was
        setResult(finished);
        setResultKind(mode);
        if (resume !== null && lastRow.current !== null) {
          const rowId = lastRow.current;
          setLog((history) => recordRetry(history, rowId, finished));
        } else {
          counter.current += 1;
          const id = `run-${counter.current}`;
          lastRow.current = id;
          setLog((history) => recordRun(history, { id, startedAt, userText: prompt, planSummary: mode === 'masks' ? MASKS_SUMMARY : current.planSummary }, finished));
        }
      } catch {
        if (mounted.current) setStartError('The run stopped unexpectedly. Check the maps, then press Generate again.');
      } finally {
        if (abort.current === controller) abort.current = null;
        if (mounted.current) {
          setRunning(false);
          setProgress(null);
        }
      }
    } finally {
      starting.current = false;
    }
  }, []);

  const generate = useCallback(() => {
    const { plan, mapsState, colorMode } = latest.current;
    const warning = describeRegenerateWarning(listMapsToReplace(plan, mapsState, colorMode));
    if (warning !== null) setConfirm({ warning });
    else void start(null);
  }, [start]);

  const confirmGenerate = useCallback(() => {
    setConfirm(null);
    void start(null);
  }, [start]);

  const dismissConfirm = useCallback(() => setConfirm(null), []);
  const cancel = useCallback(() => abort.current?.abort(), []);
  const retry = useCallback(() => void start(resultRef.current), [start]);
  const generateMasks = useCallback(() => void start(null, 'masks'), [start]);

  const canRetry = result !== null && result.failures.some((failure) => failure.retryable);
  return { running, progress, result, startError, confirm, canRetry, log, generate, confirmGenerate, dismissConfirm, cancel, retry, generateMasks, runKind, resultKind };
}
