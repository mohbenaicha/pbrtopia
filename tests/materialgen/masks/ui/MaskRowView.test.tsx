// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials, type MaskRow } from '@mat/masks';
import { MaskRowView } from '../../../../src/materialgen/masks/ui/MaskRowView';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const row: MaskRow = {
  label: 1, name: 'Wall', description: 'The brick wall', location: 'centre', defaultMaterial: 'Brick', top3: ['Brick', 'Steel'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0,
};

function setup(overrides: Partial<Parameters<typeof MaskRowView>[0]> = {}) {
  const actions = { onMaterial: vi.fn(), onRough: vi.fn(), onMetal: vi.fn(), onReset: vi.fn() };
  render(<MaskRowView row={row} colour="#00FF00" table={table} disabled={false} {...actions} {...overrides} />);
  return actions;
}

describe('materialgen/masks MaskRowView (masks R48 R57)', () => {
  it('R48 a row shows the component name with its description as tooltip and a swatch of its palette colour', () => {
    setup();
    expect(screen.getByText('Wall').getAttribute('title')).toBe('The brick wall');
    expect((screen.getByTestId('mask-swatch-1') as HTMLElement).style.backgroundColor).toBe('rgb(0, 255, 0)');
  });

  it('R57 the sliders are named for the component, and show two decimals', () => {
    setup();
    expect(screen.getByLabelText('Roughness of Wall')).toBeTruthy();
    expect(screen.getByLabelText('Metal of Wall')).toBeTruthy();
    expect(screen.getByText('0.80')).toBeTruthy();
  });

  it('R50 a released slider reports its row value', () => {
    const actions = setup();
    const slider = screen.getByLabelText('Metal of Wall');
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

  it('R52 Reset is disabled when the row is at its defaults, and reports when it is not', () => {
    const first = setup();
    expect((screen.getByRole('button', { name: 'Reset Wall' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const second = setup({ row: { ...row, rough: 0.4 } });
    fireEvent.click(screen.getByRole('button', { name: 'Reset Wall' }));
    expect(second.onReset).toHaveBeenCalledTimes(1);
    expect(first.onReset).not.toHaveBeenCalled();
  });

  it('R12 a disabled row cannot be changed', () => {
    setup({ disabled: true, row: { ...row, rough: 0.4 } });
    expect((screen.getByLabelText('Roughness of Wall') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset Wall' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R71 a row whose label no pixel uses is marked as not used', () => {
    setup({ unused: true });
    expect(screen.getByText('Not used')).toBeTruthy();
  });
});
