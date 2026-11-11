import type { GenerationPanel } from '@mat/generation';
import type { MasksModelControls } from '@mat/masks';

interface Inputs {
  generation: Pick<GenerationPanel, 'run' | 'masksProblem' | 'choice'>;
  hasAlbedo: boolean;
}

/** Masks R64-R68: the panel's Create masks, Re-run, Retry and Cancel, bound to the masks-only run of the generation panel. */
export function describeMasksModel({ generation, hasAlbedo }: Inputs): MasksModelControls {
  const { run, masksProblem, choice } = generation;
  const masksRunning = run.running && run.runKind === 'masks';
  const planRunning = run.running && run.runKind !== 'masks';
  const failed = run.resultKind === 'masks' && !run.running ? run.result?.failures ?? [] : [];
  const startError = run.runKind === 'masks' && !run.running ? run.startError : null;
  const modelId = (choice.plan.decomposition ?? choice.plan.images[0]?.settings)?.modelId ?? 'the image model';
  return {
    disabledReason: masksProblem ?? (!hasAlbedo ? 'Masks need an albedo map.' : planRunning ? 'Images are being generated.' : null),
    running: masksRunning,
    error: startError ?? (failed.length === 0 ? null : failed.map((failure) => failure.message).join(' ')),
    canRetry: run.resultKind === 'masks' && run.runKind === 'masks' && run.canRetry,
    modelNames: `the describe model and ${modelId}`,
    onCreate: run.generateMasks,
    onRerun: run.generateMasks,
    onCancel: run.cancel,
    onRetry: run.retry,
  };
}
