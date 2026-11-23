// @vitest-environment jsdom
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';
import { NANO, planOf, setupOverlay, SUNBURST } from './setupHarness';

afterEach(cleanup);

describe('SetupOverlay opened from Metal-Roughness (mask-generation R17)', () => {
  it('mask-generation R17 there is no auxiliary card', () => {
    setupOverlay({ auxiliary: false, activePlan: planOf([[0], [2], [1, 3], [4, 5]], SUNBURST) });
    expect(screen.queryByRole('group', { name: 'Auxiliary image' })).toBeNull();
    for (const name of ['Image 1', 'Image 2', 'Image 3', 'Image 4']) expect(screen.getByRole('group', { name })).toBeTruthy();
  });

  it('mask-generation R17 the presets read without "+ auxiliary"', () => {
    setupOverlay({ auxiliary: false, activePlan: planOf([[0, 1, 2, 3, 4, 5]]) });
    fireEvent.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option').map((option) => option.textContent)).toEqual([
      'Custom',
      'Default: 4 images',
      '2-2-2: 3 images of 2 views',
      '3-3: 2 images of 3 views',
    ]);
  });

  it('mask-generation R17 an aux sheet whose model is unavailable does not block Confirm, and Confirm keeps the plan\'s aux as it was', () => {
    const gone = { ...NANO, modelId: 'gone-model' };
    const { props } = setupOverlay({ auxiliary: false, activePlan: planOf([[0], [1]], gone) });
    const confirm = screen.getByRole('button', { name: 'Confirm' }) as HTMLButtonElement;
    expect(confirm.disabled).toBe(false);
    fireEvent.click(confirm);
    expect(props.onConfirm).toHaveBeenCalledWith(planOf([[0], [1]], gone));
  });

  it('mask-generation R17 with the auxiliary card on (Albedo) nothing changes: the card and the "+ auxiliary" presets are there', () => {
    setupOverlay({ activePlan: planOf([[0, 1, 2, 3, 4, 5]], SUNBURST) });
    expect(screen.getByRole('group', { name: 'Auxiliary image' })).toBeTruthy();
    fireEvent.click(screen.getByRole('combobox', { name: 'Layout preset' }));
    expect(within(screen.getByRole('listbox')).getByRole('option', { name: 'Default: 4 images + auxiliary' })).toBeTruthy();
  });
});
