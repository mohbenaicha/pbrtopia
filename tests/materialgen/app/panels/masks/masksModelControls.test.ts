import { describe, expect, it, vi } from 'vitest';
import type { RunReport } from '@mat/generation';
import { describeMasksModel } from '@mat/app/panels/masks/masksModelControls';
import { idleRun, makeGenerationPanel } from '../generate/fakeGeneration';

const report = (failures: Array<{ jobId: string; message: string; retryable: boolean }>): RunReport =>
  ({ status: 'failed', failures: failures.map((failure) => ({ ...failure, category: 'validation' })), committed: [], attempts: [] }) as unknown as RunReport;

function controls(options: { run?: Parameters<typeof idleRun>[0]; masksProblem?: string | null; hasAlbedo?: boolean } = {}) {
  const generation = { ...makeGenerationPanel({ run: options.run ?? {} }), masksProblem: options.masksProblem ?? null };
  return { generation, model: describeMasksModel({ generation, hasAlbedo: options.hasAlbedo ?? true }) };
}

describe('materialgen/masks R64 R67 R68 the panel\'s model controls', () => {
  it('R64 with a keyed plan and an albedo the actions are on and Create masks starts the masks-only run', () => {
    const { generation, model } = controls();
    expect(model.disabledReason).toBeNull();
    model.onCreate();
    expect(generation.run.generateMasks).toHaveBeenCalledOnce();
  });

  it('R64 the reason the models cannot run is the tooltip', () => {
    expect(controls({ masksProblem: 'Add your OpenAI key in Settings > Keys' }).model.disabledReason).toBe('Add your OpenAI key in Settings > Keys');
  });

  it('R64 without an albedo there is nothing to describe, and the reason says so', () => {
    expect(controls({ hasAlbedo: false }).model.disabledReason).toBe('Masks need an albedo map.');
  });

  it('R64 while the plan\'s images are being generated the model actions wait', () => {
    const { model } = controls({ run: { running: true, runKind: 'plan' } });
    expect(model.disabledReason).toBe('Images are being generated.');
    expect(model.running).toBe(false);
  });

  it('R68 a masks run in progress is shown as running and Cancel cancels the run', () => {
    const cancel = vi.fn();
    const { model } = controls({ run: { running: true, runKind: 'masks', cancel } });
    expect(model.running).toBe(true);
    model.onCancel();
    expect(cancel).toHaveBeenCalledOnce();
  });

  it('R67 the failed steps of the last masks run are named in the error, and Retry follows the run\'s own', () => {
    const retry = vi.fn();
    const failed = report([{ jobId: 'describe', message: 'Describe step: the key was refused.', retryable: true }]);
    const { model } = controls({ run: { result: failed, resultKind: 'masks', runKind: 'masks', canRetry: true, retry } });
    expect(model.error).toBe('Describe step: the key was refused.');
    expect(model.canRetry).toBe(true);
    model.onRetry();
    expect(retry).toHaveBeenCalledOnce();
  });

  it('R67 a failed plan run is not shown as a masks error', () => {
    const failed = report([{ jobId: 'image-1', message: 'Image 1: quota.', retryable: true }]);
    const { model } = controls({ run: { result: failed, resultKind: 'plan', runKind: 'plan', canRetry: true } });
    expect(model.error).toBeNull();
    expect(model.canRetry).toBe(false);
  });

  it('R67 a masks run that could not start (the vault) shows its start error', () => {
    const { model } = controls({ run: { startError: 'The key vault could not be unlocked.', runKind: 'masks' } });
    expect(model.error).toBe('The key vault could not be unlocked.');
  });

  it('R66 the question names the decomposition model of the plan', () => {
    const { generation, model } = controls();
    expect(model.modelNames).toContain(generation.choice.plan.decomposition?.modelId ?? generation.choice.plan.images[0]!.settings.modelId);
  });
});
