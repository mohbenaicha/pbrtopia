// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { GenerateAvailability } from '../../../src/generation/generateAvailability';
import { GenerateButton } from '../../../src/generation/ui/GenerateButton';

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
