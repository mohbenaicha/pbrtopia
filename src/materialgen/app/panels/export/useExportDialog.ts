import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { saveBlobAsFile } from '@shared/ui-kit';
import type { RawRecord } from '@shared/projects';
import {
  EXPORT_TARGET_CARDS, exportProgressText, exportScriptFor, exportSizeChoices, exportSuccessMessage, loadLastExportTarget, planExport, readExportBlobs,
  saveLastExportTarget, startExportInWorker, storedKindOf,
  type ExportDialogTarget, type ExportJob, type ExportOptions, type ExportPlan, type ExportProgress,
} from '@mat/export';
import type { MapsState } from '@mat/maps';
import { parseMasksRecord } from '@mat/masks';
import type { ColorMode, PreviewValues } from '@mat/storage';
import { APP_ID, APP_VERSION } from '../../appIdentity';
import { useEmissiveDraft } from './useEmissiveDraft';

export interface ExportDialogDeps {
  startExport(job: ExportJob, io: { signal: AbortSignal; onProgress(step: ExportProgress): void }): Promise<{ bytes: Uint8Array; fileName: string }>;
  saveFile(blob: Blob, fileName: string): void;
  storage: { getItem(key: string): string | null; setItem(key: string, value: string): void };
  now(): string;
}

/** Reading the property itself throws when site data is blocked; the dialog then just forgets the last target. */
function safeLocalStorage(): ExportDialogDeps['storage'] {
  try {
    return window.localStorage;
  } catch {
    return { getItem: () => null, setItem: () => undefined };
  }
}

const browserDeps = (): ExportDialogDeps => ({
  startExport: (job, { signal, onProgress }) => startExportInWorker(job, { signal, onProgress }),
  saveFile: saveBlobAsFile,
  storage: safeLocalStorage(),
  now: () => new Date().toISOString(),
});

interface UseExportDialogInput {
  projectName: string;
  colorMode: ColorMode;
  state: MapsState;
  preview: PreviewValues;
  masksRecord: RawRecord | undefined;
  readBlob(key: string): Promise<Blob | null>;
  deps?: ExportDialogDeps;
}

/** The albedo's (or diffuse's) working copy, which the emissive dialog shows under the glow; null when the project has none. */
function albedoKeyOf(state: MapsState): string | null {
  const stored = storedKindOf(state, 'albedo');
  return stored === undefined ? null : (state.maps[stored]?.workingKey ?? null);
}

type Phase = 'options' | 'running' | 'failed';
type OptionChoices = Omit<ExportOptions, 'target' | 'size'> & { target: ExportDialogTarget; size: number | null }; // size null: the project size
const PROGRESS_DELAY_MS = 300; // export R33 (proposal)

/**
 * Export R20-R22, R29, R33, R34, R36: the state of the export dialog. The options, the file list they give, and one run: the files are read when
 * Export is pressed, the work runs in the worker, the zip is saved as a download, and the dialog closes with a message. Writes nothing to the project.
 */
export function useExportDialog({ projectName, colorMode, state, preview, masksRecord, readBlob, deps }: UseExportDialogInput) {
  const dependencies = useMemo(() => deps ?? browserDeps(), [deps]);
  const [open, setOpen] = useState(false);
  const [choices, setChoices] = useState<OptionChoices>(() => ({ target: loadLastExportTarget(dependencies.storage), packing: 'separate', includeHeight: true, includeAo: true, includeMasks: false, size: null }));
  const [phase, setPhase] = useState<Phase>('options');
  const [progress, setProgress] = useState<ExportProgress | null>(null);
  const [slow, setSlow] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const controller = useRef<AbortController | null>(null);
  const emissive = useEmissiveDraft(); // R42: the one in-memory plane
  const { plane: emissivePlane, drop: dropEmissive } = emissive;

  const masks = useMemo(() => parseMasksRecord(masksRecord), [masksRecord]);
  const sizeChoices: number[] = state.size === null ? [] : exportSizeChoices(state.size);
  const size = choices.size !== null && sizeChoices.includes(choices.size) ? choices.size : (sizeChoices[0] ?? 0);
  const options: ExportOptions & { target: ExportDialogTarget } = { ...choices, size };
  const hasMasks = masks !== null;
  const planInput = { projectName, colorMode, state, hasMasks };
  const planOptions: ExportOptions = { ...options, includeEmissive: emissivePlane !== null }; // R37, R41: the plane being there is the choice
  const plan: ExportPlan = planExport(planInput, planOptions); // cheap: names and flags only, no pixels
  const cardFiles = Object.fromEntries(
    EXPORT_TARGET_CARDS.map((card) => [card.target, [...planExport(planInput, { ...planOptions, target: card.target }).files.map((file) => file.fileName), ...[exportScriptFor(card.target)?.fileName ?? []].flat()]]),
  ) as Record<ExportDialogTarget, string[]>;
  const noMasks = state.maps.labels === undefined || !hasMasks;
  const disabled = { includeHeight: state.maps.height === undefined, includeAo: state.maps.ao === undefined, includeMasks: noMasks, includeEmissive: noMasks };

  useEffect(() => () => controller.current?.abort(), []); // leaving the project ends a running export

  const show = useCallback(() => {
    setProgress(null);
    setSlow(false);
    setMessage(null);
    setError(null);
    setPhase('options');
    dropEmissive(); // R43: a dialog opened again starts without a plane
    setOpen(true);
  }, [dropEmissive]);
  const close = useCallback(() => {
    controller.current?.abort();
    dropEmissive(); // R43
    setOpen(false);
  }, [dropEmissive]);
  const setOptions = useCallback((patch: Partial<OptionChoices>) => setChoices((current) => ({ ...current, ...patch })), []);
  const cancel = useCallback(() => controller.current?.abort(), []); // the run's catch drops the plane (R43)
  const ask = useCallback(() => {
    if (phase !== 'running') emissive.ask(); // R37: no new question while an export runs
  }, [phase, emissive.ask]);

  const start = useCallback(async (): Promise<void> => {
    if (phase === 'running' || plan.files.length === 0) return;
    const abort = new AbortController();
    controller.current = abort;
    setPhase('running');
    setError(null);
    setProgress({ text: 'Reading files', done: 0, total: plan.files.length });
    setSlow(false);
    const timer = setTimeout(() => setSlow(true), PROGRESS_DELAY_MS);
    try {
      const files = await readExportBlobs(plan, state, readBlob, colorMode); // export R29: the files as they are now
      if (abort.signal.aborted) throw Object.assign(new Error('The export was cancelled.'), { name: 'AbortError' });
      const job: ExportJob = {
        plan, options: planOptions, projectName, colorMode, state,
        preview: { tilingX: preview.tilingX, tilingY: preview.tilingY, heightScale: preview.heightScale, heightLevel: preview.heightLevel },
        masks, app: { name: APP_ID, version: APP_VERSION }, exportedAt: dependencies.now(), script: exportScriptFor(options.target), files,
        emissive: emissivePlane === null ? null : { ...emissivePlane, data: emissivePlane.data.slice() }, // R42: a copy, so the worker never changes the kept plane
      };
      const result = await dependencies.startExport(job, { signal: abort.signal, onProgress: setProgress });
      dependencies.saveFile(new Blob([result.bytes as BlobPart], { type: 'application/zip' }), result.fileName);
      saveLastExportTarget(dependencies.storage, options.target);
      setMessage(exportSuccessMessage(result.fileName, result.bytes.byteLength));
      dropEmissive(); // R43: the zip is handed over, the plane is no longer needed
      setPhase('options');
      setOpen(false);
    } catch (reason) {
      if (reason instanceof Error && reason.name === 'AbortError') {
        dropEmissive(); // R43: a cancelled export keeps the other choices but not the plane
        setPhase('options');
      } else {
        setError(reason instanceof Error ? reason.message : 'The export failed.');
        setPhase('failed');
      }
    } finally {
      clearTimeout(timer);
      controller.current = null;
    }
  }, [phase, plan, options, planOptions, emissivePlane, dropEmissive, state, readBlob, colorMode, projectName, preview, masks, dependencies]);

  return {
    open, show, close, options, setOptions, plan, cardFiles, disabled, sizeChoices, canExport: plan.files.length > 0,
    emissive: {
      plane: emissivePlane, asking: emissive.asking, ask, confirm: emissive.confirm, cancelAsk: emissive.cancelAsk, drop: dropEmissive,
      // what the emissive dialog reads: the albedo as the one picture, the labels and the masks record for the swatches, the size the plane is baked at
      source: { albedoKey: albedoKeyOf(state), labelsKey: state.maps.labels?.workingKey ?? null, masksRecord, size: state.size ?? 0, readBlob },
    },
    phase, error, message, start, cancel,
    progress: phase === 'running' && slow && progress !== null ? { ...progress, label: exportProgressText(progress) } : null,
    running: phase === 'running',
  };
}
