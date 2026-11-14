// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { RunReport } from '@mat/generation';
import { GenerateSection } from '@mat/app/panels/generate/GenerateSection';
import { describeTooltipOf } from '../../../../support/tooltipDescription';
import { idleRun, makeGenerationPanel } from './fakeGeneration';

afterEach(cleanup);

const renderSection = (generation = makeGenerationPanel(), prompt = 'brick wall', canWrite = true) => {
  render(<GenerateSection generation={generation} prompt={prompt} canWrite={canWrite} />);
  return generation;
};
const generateButton = (): HTMLButtonElement => screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;

const failedReport = (patch: Partial<RunReport> = {}): RunReport => ({
  status: 'partial',
  message: 'Generated 1 of 2 images',
  committed: ['Albedo'],
  failures: [{ jobId: 'image-2', message: 'Image 2 (Normal): the model returned a bad size', retryable: true, category: 'bad-request' }],
  attempts: [],
  describeAttempt: null,
  checkpoint: {} as RunReport['checkpoint'],
  packedWarning: false,
  ...patch,
});

describe('materialgen/generation Generate section', () => {
  it('R9 R65 with a prompt and the keys the plan needs Generate is enabled and starts the run', () => {
    const generation = renderSection();
    expect(generateButton().disabled).toBe(false);
    fireEvent.click(generateButton());
    expect(generation.run.generate).toHaveBeenCalledTimes(1);
  });

  it('R65 a plan that uses GPT Image with only a Gemini key disables Generate with the OpenAI reason, and says it under the button', () => {
    renderSection(makeGenerationPanel({ presetId: 'preset-2', keyed: ['gemini'] }));
    expect(generateButton().disabled).toBe(true);
    expect(describeTooltipOf(generateButton())).toBe('Generate. Add your OpenAI key in Settings > Keys');
    expect(screen.getByText('Add your OpenAI key in Settings > Keys')).toBeTruthy();
  });

  it('R65 with no key at all Generate says to add an image model key in Settings', () => {
    renderSection(makeGenerationPanel({ keyed: [] }));
    expect(describeTooltipOf(generateButton())).toBe('Generate. Add an image model key in Settings');
  });

  it('R9 an empty prompt with no reference image disables Generate', () => {
    renderSection(makeGenerationPanel(), '   ');
    expect(describeTooltipOf(generateButton())).toBe('Generate. Enter a prompt or add a reference image.');
  });

  it('R43 while a run goes the button reads Cancel with the progress, and Cancel stops the run', () => {
    const generation = renderSection(makeGenerationPanel({ run: { running: true, progress: { finished: 2, total: 4 } } }));
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
    expect(screen.getByText('2 of 4 images')).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(generation.run.cancel).toHaveBeenCalledTimes(1);
  });

  it('R61 the regenerate warning names the originals, Cancel does not start a run and Generate does', () => {
    const generation = renderSection(makeGenerationPanel({ run: { confirm: { warning: 'Generating replaces the originals of Albedo and clears the undo of those maps. Maps you edited are replaced too.' } } }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/replaces the originals of Albedo/)).toBeTruthy();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    expect(generation.run.dismissConfirm).toHaveBeenCalledTimes(1);
    expect(generation.run.confirmGenerate).not.toHaveBeenCalled();
    fireEvent.click(within(dialog).getByRole('button', { name: 'Generate' }));
    expect(generation.run.confirmGenerate).toHaveBeenCalledTimes(1);
  });

  it('R62 the Plan summary icon shows the plan line on hover and opens an overlay with one block per image and the describe step', () => {
    renderSection();
    const summary = screen.getByRole('button', { name: 'Plan summary' });
    expect(describeTooltipOf(summary)).toMatch(/images - maps 1024 px/);
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(summary);
    const dialog = within(screen.getByRole('dialog'));
    expect(dialog.getAllByRole('listitem').length).toBeGreaterThanOrEqual(4);
    expect(dialog.getByText('Image 2 (Normal)')).toBeTruthy();
    expect(dialog.getByText(/images - maps 1024 px/)).toBeTruthy();
  });

  it('R60 a run that made everything shows its one line', () => {
    renderSection(makeGenerationPanel({ run: { result: failedReport({ status: 'done', message: 'Generated: Albedo, Normal, Height', failures: [] }) } }));
    expect(screen.getByRole('status').textContent).toContain('Generated: Albedo, Normal, Height');
  });

  it('R55 R56 a failed image is named in the error panel and Retry runs it again', () => {
    const generation = renderSection(makeGenerationPanel({ run: { result: failedReport(), canRetry: true } }));
    const panel = screen.getByRole('alert');
    expect(within(panel).getByText('Generated 1 of 2 images')).toBeTruthy();
    expect(within(panel).getByText(/Image 2 \(Normal\)/)).toBeTruthy();
    fireEvent.click(within(panel).getByRole('button', { name: 'Retry' }));
    expect(generation.run.retry).toHaveBeenCalledTimes(1);
  });

  it('R56 a failure that repeating cannot fix offers no Retry and says to change the inputs', () => {
    renderSection(makeGenerationPanel({ run: { result: failedReport(), canRetry: false } }));
    expect(screen.queryByRole('button', { name: 'Retry' })).toBeNull();
    expect(screen.getByText('Change the inputs, then press Generate.')).toBeTruthy();
  });

  it('R65 a vault that could not be unlocked is reported; cancelling the password prompt leaves no line', () => {
    renderSection(makeGenerationPanel({ run: { startError: 'The password is wrong.' } }));
    expect(screen.getByRole('alert').textContent).toBe('The password is wrong.');
    cleanup();
    renderSection(makeGenerationPanel({ run: idleRun() }));
    expect(screen.queryByRole('alert')).toBeNull();
  });

  it('R1 Custom setup opens the overlay; it is off while a run goes and while the project is read-only', () => {
    const onCustomSetup = vi.fn();
    render(<GenerateSection generation={makeGenerationPanel()} prompt="brick wall" canWrite onCustomSetup={onCustomSetup} />);
    const button = screen.getByRole('button', { name: /Custom setup/ }) as HTMLButtonElement;
    expect(button.disabled).toBe(false);
    fireEvent.click(button);
    expect(onCustomSetup).toHaveBeenCalledTimes(1);
    cleanup();

    render(<GenerateSection generation={makeGenerationPanel({ run: { running: true, progress: { finished: 0, total: 1 } } })} prompt="brick wall" canWrite onCustomSetup={onCustomSetup} />);
    expect((screen.getByRole('button', { name: /Custom setup/ }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();

    render(<GenerateSection generation={makeGenerationPanel()} prompt="brick wall" canWrite={false} onCustomSetup={onCustomSetup} />);
    expect((screen.getByRole('button', { name: /Custom setup/ }) as HTMLButtonElement).disabled).toBe(true);
  });
});
