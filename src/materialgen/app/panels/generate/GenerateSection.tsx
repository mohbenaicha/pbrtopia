import { Button, ConfirmDialog, Icon, IconButton, Spinner } from '@shared/ui-kit';
import type { GenerationPanel } from '@mat/generation';
import { describeGenerateBlock, READ_ONLY_REASON } from '../generateReason';
import { PlanSummary } from './PlanSummary';
import { RunOutcome } from './RunOutcome';

interface GenerateSectionProps {
  generation: GenerationPanel;
  prompt: string;
  canWrite: boolean;
  onCustomSetup?: () => void; // opens the setup overlay (generation R10)
}

const CUSTOM_SETUP_RUNNING = 'Custom setup is off while images are being generated.';

const describeProgress = (finished: number, total: number): string => (total === 0 ? 'Starting' : `${finished} of ${total} images`);

/** Materialgen app R14, R17, R18, generation R1, R9, R43, R61-R65: Preset, Generate (or Cancel while a run goes) with Custom setup, the plan hint and the outcome. */
export function GenerateSection({ generation, prompt, canWrite, onCustomSetup }: GenerateSectionProps): React.JSX.Element {
  const { models, report, hint, references, run } = generation;
  const block = describeGenerateBlock({ canWrite, prompt, referenceCount: references.references.length, keysReady: models.ready, planProblem: report.problem });
  const setupReason = !canWrite ? READ_ONLY_REASON : run.running ? CUSTOM_SETUP_RUNNING : null;

  return (
    <>
      <div className="material-panel__generate">
        {run.running ? (
          <Button onClick={run.cancel}>Cancel</Button>
        ) : (
          <Button variant="primary" disabled={block !== null} title={block ?? 'Generate'} onClick={run.generate}>
            Generate
          </Button>
        )}
        <PlanSummary hint={hint} />
        {setupReason === null ? (
          <IconButton label="Custom setup" icon={<Icon name="gear" />} onClick={() => onCustomSetup?.()} />
        ) : (
          <IconButton label="Custom setup" icon={<Icon name="gear" />} disabled disabledReason={setupReason} onClick={() => undefined} />
        )}
      </div>
      {run.running && run.progress !== null && (
        <p className="generate-progress" role="status">
          <Spinner decorative />
          {describeProgress(run.progress.finished, run.progress.total)}
        </p>
      )}
      {block !== null && !run.running && <p className="material-panel__hint">{block}</p>}
      <RunOutcome result={run.result} startError={run.startError} canRetry={run.canRetry && !run.running} onRetry={run.retry} />
      <ConfirmDialog open={run.confirm !== null} title="Replace existing maps?" confirmLabel="Generate" busy={false} onConfirm={run.confirmGenerate} onCancel={run.dismissConfirm}>
        <p>{run.confirm?.warning}</p>
      </ConfirmDialog>
    </>
  );
}
