// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials, type MaskRow } from '@mat/masks';
import { MaskRowView } from '../../../../src/materialgen/masks/ui/MaskRowView';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const row: MaskRow = {
  label: 1, name: 'Wall', description: 'The brick wall', location: 'centre', defaultMaterial: 'Brick', top3: ['Brick', 'Steel'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0,
};

function setup(overrides: Partial<Parameters<typeof MaskRowView>[0]> = {}) {
  const actions = { onMaterial: vi.fn(), onRough: vi.fn(), onMetal: vi.fn(), onHeight: vi.fn() };
  render(<MaskRowView row={row} table={table} disabled={false} heightDisabledReason={null} onMix={vi.fn()} mixDisabledReason={null} {...actions} {...overrides} />);
  return actions;
}

describe('materialgen/masks MaskRowView (masks R48 R57)', () => {
  it('R48 a block shows the component name with its description as tooltip, and nothing else around it', () => {
    setup();
    expect(screen.getByText('Wall').getAttribute('title')).toBe('The brick wall');
    expect(document.querySelector('.mask-row__swatch')).toBeNull();
    expect(screen.queryByText('Not used')).toBeNull();
  });

  it('R48 the block is a group named by the component, with Roughness and Metalness rows that show two decimals', () => {
    setup();
    const group = screen.getByRole('group', { name: 'Wall' });
    expect(group.querySelector('input[aria-label="Roughness"]')).toBeTruthy();
    expect(group.querySelector('input[aria-label="Metalness"]')).toBeTruthy();
    expect(screen.getByText('0.80')).toBeTruthy();
    expect(screen.getByText('0.00')).toBeTruthy();
  });

  it('R50 a released slider reports its row value', () => {
    const actions = setup();
    const slider = screen.getByLabelText('Metalness');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.5' } });
    fireEvent.pointerUp(slider);
    expect(actions.onMetal).toHaveBeenCalledWith(0.5);
    expect(actions.onRough).not.toHaveBeenCalled();
  });

  it('R37 R40 the select lists the suggested materials first and picking one reports its name', () => {
    const actions = setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Base material of Wall' }));
    const options = screen.getAllByRole('option').map((option) => option.querySelector('.ui-select__option-label')?.textContent);
    expect(options.slice(0, 2)).toEqual(['Brick', 'Steel']);
    expect(options).toContain('Generic');
    fireEvent.click(screen.getByRole('option', { name: /^Generic/ }));
    expect(actions.onMaterial).toHaveBeenCalledWith('Generic');
  });

  it('R37 the suggested materials sit under a Suggested heading, each option shows its roughness and metal, and the rest are under All materials', () => {
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Base material of Wall' }));
    expect(screen.getByText('Suggested')).toBeTruthy();
    expect(screen.getByText('All materials')).toBeTruthy();
    expect(screen.getAllByRole('option')[0]!.textContent).toContain('0.80 / 0.00');
    expect(screen.getAllByRole('option')[1]!.textContent).toContain('0.30 / 1.00');
  });

  it('R37 typing in the select filters the names, and a filter with no match says "No material matches"', () => {
    setup();
    fireEvent.click(screen.getByRole('combobox', { name: 'Base material of Wall' }));
    const filter = screen.getByRole('searchbox');
    fireEvent.change(filter, { target: { value: 'STE' } });
    expect(screen.getAllByRole('option').map((option) => option.querySelector('.ui-select__option-label')?.textContent)).toEqual(['Steel']);
    fireEvent.change(filter, { target: { value: 'zzz' } });
    expect(screen.getByText('No material matches')).toBeTruthy();
  });

  it('R35 the select says its values are estimated defaults', () => {
    setup();
    expect(screen.getByRole('combobox', { name: 'Base material of Wall' }).getAttribute('title')).toBe('Estimated default');
  });

  it('R48 the reset arrows are disabled while the sliders are at the chosen material\'s values, and a click saves that value', () => {
    const first = setup();
    expect((screen.getByRole('button', { name: 'Reset Roughness' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset Metalness' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const second = setup({ row: { ...row, rough: 0.4, metal: 0.6 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Roughness' }));
    expect(second.onRough).toHaveBeenCalledWith(0.8);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Metalness' }));
    expect(second.onMetal).toHaveBeenCalledWith(0);
    expect(first.onRough).not.toHaveBeenCalled();
  });

  it('R48 a row whose material is not in the table has no value to go back to: its reset arrows are disabled', () => {
    setup({ row: { ...row, material: 'Gone', rough: 0.4 } });
    expect((screen.getByRole('button', { name: 'Reset Roughness' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R81 R57 the Height row comes last: a slider from -1 to +1 with 0 in the middle, a signed two-decimal readout and a Reset Height arrow', () => {
    setup({ row: { ...row, height: 0.4 } });
    const group = screen.getByRole('group', { name: 'Wall' });
    const labels = Array.from(group.querySelectorAll('input[type="range"]')).map((input) => input.getAttribute('aria-label'));
    expect(labels).toEqual(['Roughness', 'Metalness', 'Height']);
    const slider = screen.getByLabelText('Height') as HTMLInputElement;
    expect([slider.min, slider.max, slider.step]).toEqual(['-1', '1', '0.01']);
    expect(screen.getByText('+0.40')).toBeTruthy();
  });

  it('R81 the readout of height 0 is +0.00 and a negative one carries its minus sign', () => {
    setup();
    expect(screen.getByText('+0.00')).toBeTruthy();
    cleanup();
    setup({ row: { ...row, height: -0.25 } });
    expect(screen.getByText('-0.25')).toBeTruthy();
  });

  it('R81 R50 a released Height slider reports its value; the reset arrow is off at 0 and saves 0 otherwise', () => {
    const first = setup();
    expect((screen.getByRole('button', { name: 'Reset Height' }) as HTMLButtonElement).disabled).toBe(true);
    const slider = screen.getByLabelText('Height');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '-0.6' } });
    fireEvent.pointerUp(slider);
    expect(first.onHeight).toHaveBeenCalledWith(-0.6);
    cleanup();
    const second = setup({ row: { ...row, height: 0.4 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Height' }));
    expect(second.onHeight).toHaveBeenCalledWith(0);
  });

  it('R81 with no height map the Height slider is disabled and says "Add a height map first"; the other sliders still work', () => {
    setup({ heightDisabledReason: 'Add a height map first' });
    expect((screen.getByLabelText('Height') as HTMLInputElement).disabled).toBe(true);
    expect(screen.getByLabelText('Height').closest('[title]')?.getAttribute('title')).toBe('Add a height map first');
    expect((screen.getByLabelText('Roughness') as HTMLInputElement).disabled).toBe(false);
  });

  describe('colour mixin (R90)', () => {
    const mixOn: MaskRow = { ...row, mix: { on: true, invert: false, rough: 0.5, metal: 0.5 } };
    const withMix = (overrides: Partial<Parameters<typeof MaskRowView>[0]> = {}) => {
      const onMix = vi.fn();
      setup({ onMix, mixDisabledReason: null, ...overrides });
      return onMix;
    };
    const mixGroup = (): HTMLElement => screen.getByRole('group', { name: 'Colour mixin' });

    it('R90 the Colour mixin switch comes after Height and, off, shows no Invert and no mixin sliders', () => {
      withMix();
      const toggle = screen.getByRole('switch', { name: 'Colour mixin' }) as HTMLInputElement;
      expect(toggle.checked).toBe(false);
      expect(screen.queryByRole('switch', { name: 'Invert' })).toBeNull();
      expect(screen.queryByRole('group', { name: 'Colour mixin' })).toBeNull();
      const height = screen.getByLabelText('Height');
      expect(height.compareDocumentPosition(toggle) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    });

    it('R90 on, it shows an indented Invert switch (off) and Roughness and Metalness sliders at 0.50', () => {
      withMix({ row: mixOn });
      const group = mixGroup();
      expect((within(group).getByRole('switch', { name: 'Invert' }) as HTMLInputElement).checked).toBe(false);
      expect(within(group).getByLabelText('Roughness')).toBeTruthy();
      expect(within(group).getByLabelText('Metalness')).toBeTruthy();
      expect(within(group).getAllByText('0.50')).toHaveLength(2);
    });

    it('R90 the switches report their change and a released slider reports its value; the arrows go back to 0.5', () => {
      const onMix = withMix({ row: { ...mixOn, mix: { on: true, invert: false, rough: 0.8, metal: 0.5 } } });
      fireEvent.click(screen.getByRole('switch', { name: 'Invert' }));
      expect(onMix).toHaveBeenLastCalledWith({ invert: true });
      const slider = within(mixGroup()).getByLabelText('Metalness');
      fireEvent.pointerDown(slider);
      fireEvent.change(slider, { target: { value: '0.9' } });
      fireEvent.pointerUp(slider);
      expect(onMix).toHaveBeenLastCalledWith({ metal: 0.9 });
      fireEvent.click(within(mixGroup()).getByRole('button', { name: 'Reset Roughness' }));
      expect(onMix).toHaveBeenLastCalledWith({ rough: 0.5 });
      fireEvent.click(screen.getByRole('switch', { name: 'Colour mixin' }));
      expect(onMix).toHaveBeenLastCalledWith({ on: false });
    });

    it('R90 with no albedo the switch is disabled and says "No albedo map"', () => {
      withMix({ mixDisabledReason: 'No albedo map' });
      const toggle = screen.getByRole('switch', { name: 'Colour mixin' }) as HTMLInputElement;
      expect(toggle.disabled).toBe(true);
      expect(toggle.closest('label')?.getAttribute('title')).toBe('No albedo map');
    });
  });

  it('R12 a disabled block cannot be changed', () => {
    setup({ disabled: true, row: { ...row, rough: 0.4 } });
    expect((screen.getByLabelText('Roughness') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset Roughness' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('combobox', { name: 'Base material of Wall' }) as HTMLButtonElement).disabled).toBe(true);
  });
});
