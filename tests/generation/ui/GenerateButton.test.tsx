// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateAvailability } from '../../../src/generation/generateAvailability';
import { GenerateButton } from '../../../src/generation/ui/GenerateButton';
import { openTooltipTextOf } from '../../support/tooltipDescription';

afterEach(cleanup);

function setup(availability: GenerateAvailability) {
  const onGenerate = vi.fn();
  const onGenerateUv = vi.fn();
  render(<GenerateButton availability={availability} onGenerate={onGenerate} onGenerateUv={onGenerateUv} />);
  return { onGenerate, onGenerateUv };
}

describe('GenerateButton (R6, R15)', () => {
  it('R6 an enabled Generate button calls onGenerate only, and shows no reason', () => {
    const { onGenerate, onGenerateUv } = setup({ action: 'generate', enabled: true, reason: null });
    fireEvent.click(screen.getByRole('button', { name: 'Generate' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(onGenerateUv).not.toHaveBeenCalled();
    expect(document.querySelector('.generate-button__reason')).toBeNull();
  });

  it('R15 a model with no UVs offers Generate UV, which calls onGenerateUv only', () => {
    const { onGenerate, onGenerateUv } = setup({ action: 'generate-uv', enabled: true, reason: null });
    expect(screen.queryByRole('button', { name: 'Generate' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate UV' }));
    expect(onGenerateUv).toHaveBeenCalledTimes(1);
    expect(onGenerate).not.toHaveBeenCalled();
  });

  it('R6 a disabled button does nothing and the reason is written under it', () => {
    const { onGenerate } = setup({ action: 'generate', enabled: false, reason: 'Load a 3D model first.' });
    const button = screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement;
    expect(button.disabled).toBe(true);
    fireEvent.click(button);
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByText('Load a 3D model first.')).toBeTruthy();
  });
});

describe('GenerateButton: custom runs (custom R1)', () => {
  it('custom R1 a custom plan reads Generate (custom) and the number of images is the tooltip', () => {
    const { onGenerate } = setup({ action: 'generate', enabled: true, reason: null, imageCount: 3 });
    const button = screen.getByRole('button', { name: 'Generate (custom)' });
    expect(openTooltipTextOf(button)).toBe('Generate (custom). 3 images');
    fireEvent.click(button);
    expect(onGenerate).toHaveBeenCalledTimes(1);
  });

  it('custom R1 one image reads "1 image"', () => {
    setup({ action: 'generate', enabled: true, reason: null, imageCount: 1 });
    expect(openTooltipTextOf(screen.getByRole('button', { name: 'Generate (custom)' }))).toBe('Generate (custom). 1 image');
  });

  it('custom R1 four images start at once without a question', () => {
    const { onGenerate } = setup({ action: 'generate', enabled: true, reason: null, imageCount: 4 });
    fireEvent.click(screen.getByRole('button', { name: 'Generate (custom)' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('custom R1 more than four images ask "Generate 6 images?" first; Generate starts the run, Cancel does not', () => {
    const { onGenerate } = setup({ action: 'generate', enabled: true, reason: null, imageCount: 6 });
    fireEvent.click(screen.getByRole('button', { name: 'Generate (custom)' }));
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: 'Generate 6 images?' })).toBeTruthy();
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(onGenerate).not.toHaveBeenCalled();
    expect(screen.queryByRole('dialog')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Generate (custom)' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Generate' }));
    expect(onGenerate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('dialog')).toBeNull();
  });

  it('custom R1 a blocked custom plan keeps the plain label and writes the reason', () => {
    setup({ action: 'generate', enabled: false, reason: 'Set up the custom generation first.' });
    expect((screen.getByRole('button', { name: 'Generate' }) as HTMLButtonElement).disabled).toBe(true);
    expect(screen.getByText('Set up the custom generation first.')).toBeTruthy();
  });
});
