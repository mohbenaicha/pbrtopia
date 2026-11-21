// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials, type MaskRow, type MasksRecord } from '@shared/materialMasks';
import { MasksPanel, type MasksPanelProps, type PanelRevealHandlers } from '@shared/materialMasks/ui';
import { describeTooltipOf } from '../../support/tooltipDescription';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const row = (label: number, name: string, material = 'Brick', rough = 0.8, metal = 0): MaskRow => ({
  label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick', 'Steel'], matchKind: 'keyword', material, rough, metal, height: 0,
});
const record = (overrides: Partial<MasksRecord> = {}): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 1,
  rows: [row(0, 'Wall'), row(1, 'Trim')],
  ...overrides,
});

function setup(overrides: Partial<MasksPanelProps> = {}) {
  const actions = { onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onRowHeight: vi.fn(), onRowMix: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn() };
  const props: MasksPanelProps = { record: record(), table, tableProblem: null, stale: false, canWrite: true, hasHeightMap: true, hasAlbedo: true, ...actions, ...overrides };
  render(<MasksPanel {...props} />);
  return actions;
}
const swatch = (name: string): HTMLElement => screen.getByRole('button', { name });
/** Selects a component's swatch (masks R48) and returns its block. */
const block = (name: string): HTMLElement => {
  for (const other of screen.getAllByRole('button').filter((button) => button.classList.contains('mask-swatch') && button.getAttribute('aria-pressed') === 'true' && button.getAttribute('aria-label') !== name)) fireEvent.click(other); // only this one stays selected (R89 toggles)
  if (swatch(name).getAttribute('aria-pressed') !== 'true') fireEvent.click(swatch(name));
  return screen.getByRole('group', { name });
};

describe('materialgen/masks MasksPanel (masks R48-R57 R59 R66-R68)', () => {
  it('R49 with no masks the panel draws nothing: the masks come from the generation flow, not from buttons here', () => {
    setup({ record: null, table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('R48 the components are swatches in label order, each filled with its palette colour; nothing is selected at first, so no block is drawn and a hint says what to do', () => {
    setup();
    const swatches = screen.getAllByRole('button').filter((button) => button.classList.contains('mask-swatch'));
    expect(swatches.map((button) => button.getAttribute('aria-label'))).toEqual(['Wall', 'Trim']);
    expect(swatches.map((button) => (button as HTMLElement).style.backgroundColor)).toEqual(['rgb(255, 0, 0)', 'rgb(0, 255, 0)']);
    expect(swatches.map((button) => button.getAttribute('aria-pressed'))).toEqual(['false', 'false']);
    expect(screen.getByText('Select a material to edit its properties')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
    expect(screen.queryByRole('combobox')).toBeNull();
  });

  it('R80 hovering or focusing a swatch highlights that component, leaving or blurring clears it, and the panel going away clears it', () => {
    const onHighlight = vi.fn();
    const { unmount } = render(<MasksPanel {...({ record: record(), table, tableProblem: null, stale: false, canWrite: true, hasHeightMap: true, hasAlbedo: true, onRowMix: vi.fn(),onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onRowHeight: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn(), onHighlight } as MasksPanelProps)} />);
    fireEvent.pointerEnter(swatch('Wall'));
    expect(onHighlight).toHaveBeenLastCalledWith(0);
    fireEvent.pointerLeave(swatch('Wall'));
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    fireEvent.focus(swatch('Trim'));
    expect(onHighlight).toHaveBeenLastCalledWith(1);
    fireEvent.blur(swatch('Trim'));
    expect(onHighlight).toHaveBeenLastCalledWith(null);
    fireEvent.pointerEnter(swatch('Trim'));
    onHighlight.mockClear();
    unmount();
    expect(onHighlight).toHaveBeenCalledWith(null);
  });

  it('R80 a highlight never changes anything stored: no commit, no row change', () => {
    const actions = setup();
    fireEvent.pointerEnter(swatch('Wall'));
    fireEvent.pointerLeave(swatch('Wall'));
    expect(actions.onRowMaterial).not.toHaveBeenCalled();
    expect(actions.onRowRough).not.toHaveBeenCalled();
    expect(actions.onResetAll).not.toHaveBeenCalled();
  });

  it('R48 R89 clicking a swatch draws one block; clicking another adds it (the block follows the last clicked), clicking a selected one takes it out', () => {
    setup();
    fireEvent.click(swatch('Wall'));
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Wall']);
    expect(swatch('Wall').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(swatch('Trim'));
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Trim']);
    expect(swatch('Wall').getAttribute('aria-pressed')).toBe('true');
    fireEvent.click(swatch('Trim'));
    fireEvent.click(swatch('Wall'));
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('R48 the grid has five columns, so up to five components make one row and six to ten make two', () => {
    const ten = Array.from({ length: 10 }, (_, label) => row(label, `Part ${label}`));
    setup({ record: record({ rows: ten, palette: ten.map((r) => ({ label: r.label, hex: '#808080', name: 'grey' })) }) });
    const grid = document.querySelector('.mask-swatches') as HTMLElement;
    expect(grid.querySelectorAll('.mask-swatch')).toHaveLength(10);
    expect(grid.style.getPropertyValue('--mask-swatch-columns')).toBe('5');
  });

  it('R48 a selection that no longer names a component is cleared when the labels are rebuilt', () => {
    const view = render(<MasksPanel {...({ record: record(), table, tableProblem: null, stale: false, canWrite: true, hasHeightMap: true, hasAlbedo: true, onRowMix: vi.fn(),onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onRowHeight: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn() } as MasksPanelProps)} />);
    fireEvent.click(view.getByRole('button', { name: 'Wall' }));
    expect(view.queryByRole('group', { name: 'Wall' })).not.toBeNull();
    view.rerender(<MasksPanel {...({ record: record({ rows: [row(5, 'Glass')], palette: [{ label: 5, hex: '#0000FF', name: 'blue' }] }), table, tableProblem: null, stale: false, canWrite: true, hasHeightMap: true, hasAlbedo: true, onRowMix: vi.fn(),onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onRowHeight: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn() } as MasksPanelProps)} />);
    expect(view.queryByRole('group')).toBeNull();
  });

  it('R48 a block holds the name, the base-material select under it, then Roughness, Metalness and Height; no "not used" mark, no row reset', () => {
    setup();
    const wall = block('Wall');
    const order = [...wall.querySelectorAll('.mask-row__name, [role="combobox"], input[type="range"]')].map((node) => (node.getAttribute('role') === 'combobox' ? 'select' : (node.getAttribute('aria-label') ?? node.textContent)));
    expect(order).toEqual(['Wall', 'select', 'Roughness', 'Metalness', 'Height']);
    expect(within(wall).queryByText('Not used')).toBeNull();
    expect(within(wall).queryByRole('button', { name: 'Reset Wall' })).toBeNull();
  });

  it('R49 the order is Feather, the hint and swatches, the selected block, then Reset all at the bottom; there is no overlay switch and no Re-quantise here', () => {
    setup();
    const feather = screen.getByLabelText('Feather');
    const hint = screen.getByText('Select a material to edit its properties');
    const first = swatch('Wall');
    const wall = block('Wall');
    const resetAll = screen.getByRole('button', { name: 'Reset all' });
    const follows = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(feather, hint)).toBe(true);
    expect(follows(hint, first)).toBe(true);
    expect(follows(first, wall)).toBe(true);
    expect(follows(wall, resetAll)).toBe(true);
    expect(screen.queryByRole('switch', { name: /overlay/i })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-quantise' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-run decomposition' })).toBeNull(); // the core panel has no Re-run: the host fills the footer
    expect(resetAll.getAttribute('data-variant')).toBe('secondary');
  });

  it('R89 a click toggles a swatch, so several can be selected; the block is named by the last clicked and shows how many others', () => {
    setup();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(swatch('Trim'));
    expect(swatch('Wall').getAttribute('aria-pressed')).toBe('true');
    expect(swatch('Trim').getAttribute('aria-pressed')).toBe('true');
    const nameLine = (name: string): string => screen.getByRole('group', { name }).querySelector('.mask-row__name')?.textContent ?? '';
    expect(nameLine('Trim')).toBe('Trim +1');
    fireEvent.click(swatch('Trim'));
    expect(swatch('Trim').getAttribute('aria-pressed')).toBe('false');
    expect(nameLine('Wall')).toBe('Wall');
    fireEvent.click(swatch('Wall'));
    expect(screen.queryByRole('group')).toBeNull(); // nothing selected: no block
  });

  it('R89 with two selected, a released slider, the material select and a reset arrow report both labels in label order; the block shows the last clicked one\'s values', () => {
    const actions = setup({ record: record({ rows: [row(0, 'Wall', 'Brick', 0.8, 0), row(1, 'Trim', 'Steel', 0.3, 1)] }) });
    fireEvent.click(swatch('Trim'));
    fireEvent.click(swatch('Wall')); // Wall was clicked last
    const group = within(screen.getByRole('group', { name: 'Wall' }));
    expect((group.getByLabelText('Roughness') as HTMLInputElement).value).toBe('0.8');
    const rough = group.getByLabelText('Roughness');
    fireEvent.pointerDown(rough);
    fireEvent.change(rough, { target: { value: '0.6' } });
    fireEvent.pointerUp(rough);
    expect(actions.onRowRough).toHaveBeenCalledWith([0, 1], 0.6);
    fireEvent.click(group.getByRole('button', { name: 'Reset Metalness' }));
    expect(actions.onRowMetal).not.toHaveBeenCalled(); // Wall's metalness is already at Brick's value
    const height = group.getByLabelText('Height');
    fireEvent.pointerDown(height);
    fireEvent.change(height, { target: { value: '0.4' } });
    fireEvent.pointerUp(height);
    expect(actions.onRowHeight).toHaveBeenCalledWith([0, 1], 0.4);
  });

  it('R50 a released slider reports the label and the value', () => {
    const actions = setup();
    const slider = within(block('Trim')).getByLabelText('Roughness');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.3' } });
    fireEvent.pointerUp(slider);
    expect(actions.onRowRough).toHaveBeenCalledWith([1], 0.3);
    const metal = within(block('Wall')).getByLabelText('Metalness');
    fireEvent.pointerDown(metal);
    fireEvent.change(metal, { target: { value: '0.5' } });
    fireEvent.pointerUp(metal);
    expect(actions.onRowMetal).toHaveBeenCalledWith([0], 0.5);
  });

  it('R81 a released Height slider reports the label and the signed value', () => {
    const actions = setup();
    const height = within(block('Trim')).getByLabelText('Height');
    fireEvent.pointerDown(height);
    fireEvent.change(height, { target: { value: '-0.4' } });
    fireEvent.pointerUp(height);
    expect(actions.onRowHeight).toHaveBeenCalledWith([1], -0.4);
  });

  it('R90 R89 the Colour mixin switch reports the selected labels, and with no albedo it is off, saying why; Reset all counts a mixin that is on as a change', () => {
    const actions = setup();
    fireEvent.click(swatch('Wall'));
    fireEvent.click(swatch('Trim'));
    fireEvent.click(screen.getByRole('switch', { name: 'Colour mixin' }));
    expect(actions.onRowMix).toHaveBeenCalledWith([0, 1], { on: true });
    cleanup();
    setup({ hasAlbedo: false });
    fireEvent.click(swatch('Wall'));
    const toggle = screen.getByRole('switch', { name: 'Colour mixin' }) as HTMLInputElement;
    expect(toggle.disabled).toBe(true);
    expect(describeTooltipOf(toggle)).toBe('Colour mixin. No albedo map');
    cleanup();
    setup({ record: record({ rows: [{ ...row(0, 'Wall'), mix: { on: true, invert: false, rough: 0.5, metal: 0.5 } }, row(1, 'Trim')] }) });
    expect((screen.getByRole('button', { name: 'Reset all' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('R81 R86 the Height slider is off with no height map, saying why; Reset all counts a height offset as a change', () => {
    setup({ hasHeightMap: false });
    const height = within(block('Wall')).getByLabelText('Height') as HTMLInputElement;
    expect(height.disabled).toBe(true);
    expect(describeTooltipOf(height)).toBe('Height. Add a height map first');
    cleanup();
    setup({ record: record({ rows: [{ ...row(0, 'Wall'), height: 0.3 }, row(1, 'Trim')] }) });
    expect((screen.getByRole('button', { name: 'Reset all' }) as HTMLButtonElement).disabled).toBe(false);
  });

  it('R48 R52 the reset arrow of a slider puts it back to the value of the row\'s chosen base material, and is disabled at that value', () => {
    const actions = setup({ record: record({ rows: [row(0, 'Wall', 'Brick', 0.1, 0.4), row(1, 'Trim', 'Steel', 0.3, 1)] }) });
    const wall = within(block('Wall'));
    fireEvent.click(wall.getByRole('button', { name: 'Reset Roughness' }));
    expect(actions.onRowRough).toHaveBeenCalledWith([0], 0.8); // Brick
    fireEvent.click(wall.getByRole('button', { name: 'Reset Metalness' }));
    expect(actions.onRowMetal).toHaveBeenCalledWith([0], 0); // Brick
    const trim = within(block('Trim'));
    expect((trim.getByRole('button', { name: 'Reset Roughness' }) as HTMLButtonElement).disabled).toBe(true); // Steel 0.3
    expect((trim.getByRole('button', { name: 'Reset Metalness' }) as HTMLButtonElement).disabled).toBe(true); // Steel 1
  });

  it('R53 Reset all is disabled while every row is at its defaults, and reports when one is not', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Reset all' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const actions = setup({ record: record({ rows: [row(0, 'Wall', 'Brick', 0.1), row(1, 'Trim')] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(actions.onResetAll).toHaveBeenCalledTimes(1);
  });

  it('R54 the feather commits on release', () => {
    const actions = setup();
    const feather = screen.getByLabelText('Feather');
    fireEvent.pointerDown(feather);
    fireEvent.change(feather, { target: { value: '3' } });
    fireEvent.pointerUp(feather);
    expect(actions.onFeather).toHaveBeenCalledWith(3);
  });

  it('R22 removed: a stored coverage figure from an older record never shows a warning', () => {
    setup({ record: { ...record(), coverage: 12 } as MasksRecord });
    expect(screen.queryByText(/matched the palette/)).toBeNull();
  });

  it('R59 stale masks show the status line above the buttons, with no local-masks button, while the rows stay', () => {
    setup({ stale: true });
    const message = screen.getByText('Albedo changed since the masks were made');
    expect(message.compareDocumentPosition(screen.getByRole('button', { name: 'Reset all' })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(screen.queryByRole('button', { name: 'Use local masks' })).toBeNull();
    expect(within(block('Wall')).getByLabelText('Roughness')).toBeTruthy();
  });

  it('R59 without stale masks there is no status line', () => {
    setup();
    expect(screen.queryByText('Albedo changed since the masks were made')).toBeNull();
  });

  it('R12 a read-only project disables every change', () => {
    setup({ canWrite: false, record: record({ rows: [row(0, 'Wall', 'Brick', 0.1), row(1, 'Trim')] }) });
    expect((within(block('Wall')).getByLabelText('Roughness') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByLabelText('Feather') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Reset all' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R34 a base-material table that could not be loaded is said so and the blocks are not offered', () => {
    setup({ table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.getByText('The material list could not be loaded.')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('R25 there is no Source choice and no Components count', () => {
    setup();
    expect(screen.queryByRole('combobox', { name: 'Components' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
  });
});

describe('material-masks-core MasksPanel host slots', () => {
  it('material-masks-core R8 the panel renders without tour props or slots, and with a revealRef it forwards open and close handlers that select the first swatch and clear it', () => {
    setup();
    expect(screen.getByText('Select a material to edit its properties')).toBeTruthy();
    cleanup();
    const revealRef: { current: PanelRevealHandlers | null } = { current: null };
    setup({ revealRef });
    expect(revealRef.current).not.toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
    act(() => revealRef.current!.open());
    expect(screen.getByRole('group', { name: 'Wall' })).toBeTruthy();
    act(() => revealRef.current!.close());
    expect(screen.queryByRole('group')).toBeNull();
    cleanup();
    expect(revealRef.current).toBeNull(); // the handlers go with the panel
  });

  it('material-masks-core R1 a notice slot is drawn above the buttons row and a footer slot beside Reset all, both told whether changes are locked', () => {
    const notice = vi.fn(() => <p role="status">host notice</p>);
    const footer = vi.fn(() => <button type="button">Host action</button>);
    setup({ canWrite: false, notice, footer });
    const resetAll = screen.getByRole('button', { name: 'Reset all' });
    const hostAction = screen.getByRole('button', { name: 'Host action' });
    expect(hostAction.closest('.masks-panel__buttons')).toBe(resetAll.closest('.masks-panel__buttons'));
    expect(screen.getByText('host notice').compareDocumentPosition(resetAll) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
    expect(footer).toHaveBeenCalledWith({ locked: true, lockedReason: expect.stringContaining('another tab') });
    expect(notice).toHaveBeenCalledWith({ locked: true, lockedReason: expect.any(String) });
  });
});
