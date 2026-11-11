// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials, type MaskRow, type MasksRecord } from '@mat/masks';
import { MasksPanel, type MasksModelControls, type MasksPanelProps } from '../../../../src/materialgen/masks/ui/MasksPanel';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const row = (label: number, name: string, material = 'Brick', rough = 0.8, metal = 0): MaskRow => ({
  label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick', 'Steel'], matchKind: 'keyword', material, rough, metal,
});
const record = (overrides: Partial<MasksRecord> = {}): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 1,
  rows: [row(0, 'Wall'), row(1, 'Trim')],
  ...overrides,
});

const idleModel = (patch: Partial<MasksModelControls> = {}): MasksModelControls => ({
  disabledReason: 'Needs the image models.', running: false, error: null, canRetry: false, modelNames: 'gpt-6-luna and gpt-image-2.5',
  onCreate: vi.fn(), onRerun: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), ...patch,
});

function setup(overrides: Partial<MasksPanelProps> = {}) {
  const actions = { onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn() };
  const props: MasksPanelProps = { record: record(), table, tableProblem: null, stale: false, canWrite: true, model: idleModel(), ...actions, ...overrides };
  render(<MasksPanel {...props} />);
  return { ...actions, model: props.model };
}
const block = (name: string): HTMLElement => screen.getByRole('group', { name });

describe('materialgen/masks MasksPanel (masks R48-R57 R59 R66-R68)', () => {
  it('R49 with no masks the panel draws nothing: the masks come from the generation flow, not from buttons here', () => {
    setup({ record: null, table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('R48 one block per component in label order, each a group named by the component', () => {
    setup();
    expect(screen.getAllByRole('group').map((group) => group.getAttribute('aria-label'))).toEqual(['Wall', 'Trim']);
  });

  it('R48 a block holds the name, the base-material select under it, then Roughness and Metalness; no swatch, no "not used" mark, no row reset', () => {
    setup();
    const wall = block('Wall');
    const order = [...wall.querySelectorAll('.mask-row__name, [role="combobox"], input[type="range"]')].map((node) => (node.getAttribute('role') === 'combobox' ? 'select' : (node.getAttribute('aria-label') ?? node.textContent)));
    expect(order).toEqual(['Wall', 'select', 'Roughness', 'Metalness']);
    expect(wall.querySelector('.mask-row__swatch')).toBeNull();
    expect(within(wall).queryByText('Not used')).toBeNull();
    expect(within(wall).queryByRole('button', { name: 'Reset Wall' })).toBeNull();
  });

  it('R49 the order is Feather, the blocks, then Reset all and Re-run decomposition side by side at the bottom; there is no overlay switch and no Re-quantise here', () => {
    setup({ model: idleModel({ disabledReason: null }) });
    const feather = screen.getByLabelText('Feather');
    const wall = block('Wall');
    const resetAll = screen.getByRole('button', { name: 'Reset all' });
    const rerun = screen.getByRole('button', { name: 'Re-run decomposition' });
    const follows = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(feather, wall)).toBe(true);
    expect(follows(block('Trim'), resetAll)).toBe(true);
    expect(follows(resetAll, rerun)).toBe(true);
    expect(resetAll.parentElement).toBe(rerun.parentElement);
    expect(screen.queryByRole('switch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Re-quantise' })).toBeNull();
  });

  it('R49 Re-run decomposition is the primary (gold, dark text) button and Reset all is not', () => {
    setup({ model: idleModel({ disabledReason: null }) });
    expect(screen.getByRole('button', { name: 'Re-run decomposition' }).getAttribute('data-variant')).toBe('primary');
    expect(screen.getByRole('button', { name: 'Reset all' }).getAttribute('data-variant')).toBe('secondary');
  });

  it('R50 a released slider reports the label and the value', () => {
    const actions = setup();
    const slider = within(block('Trim')).getByLabelText('Roughness');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.3' } });
    fireEvent.pointerUp(slider);
    expect(actions.onRowRough).toHaveBeenCalledWith(1, 0.3);
    const metal = within(block('Wall')).getByLabelText('Metalness');
    fireEvent.pointerDown(metal);
    fireEvent.change(metal, { target: { value: '0.5' } });
    fireEvent.pointerUp(metal);
    expect(actions.onRowMetal).toHaveBeenCalledWith(0, 0.5);
  });

  it('R48 R52 the reset arrow of a slider puts it back to the value of the row\'s chosen base material, and is disabled at that value', () => {
    const actions = setup({ record: record({ rows: [row(0, 'Wall', 'Brick', 0.1, 0.4), row(1, 'Trim', 'Steel', 0.3, 1)] }) });
    const wall = within(block('Wall'));
    fireEvent.click(wall.getByRole('button', { name: 'Reset Roughness' }));
    expect(actions.onRowRough).toHaveBeenCalledWith(0, 0.8); // Brick
    fireEvent.click(wall.getByRole('button', { name: 'Reset Metalness' }));
    expect(actions.onRowMetal).toHaveBeenCalledWith(0, 0); // Brick
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

  it('R59 stale masks show the status line above the buttons, with one Re-run decomposition button and no local-masks button, while the rows stay', () => {
    setup({ stale: true, model: idleModel({ disabledReason: null }) });
    const message = screen.getByText('Albedo changed since the masks were made');
    expect(screen.getAllByRole('button', { name: 'Re-run decomposition' })).toHaveLength(1);
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
    expect((screen.getByRole('button', { name: 'Re-run decomposition' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R34 a base-material table that could not be loaded is said so and the blocks are not offered', () => {
    setup({ table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.getByText('The material list could not be loaded.')).toBeTruthy();
    expect(screen.queryByRole('group')).toBeNull();
  });

  it('R25 there is no Source choice and no Components count; Re-run is off with the reason when the models are missing', () => {
    setup();
    expect(screen.queryByRole('combobox', { name: 'Components' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    const rerun = screen.getByRole('button', { name: 'Re-run decomposition' }) as HTMLButtonElement;
    expect(rerun.disabled).toBe(true);
    expect(rerun.title).toBe('Needs the image models.');
  });

  it('R67 R68 while masks exist a running re-run shows its message and Cancel; a failed step shows Retry only', () => {
    const running = setup({ model: idleModel({ disabledReason: null, running: true }) });
    expect(screen.getAllByRole('status').map((node) => node.textContent).join(' ')).toMatch(/building the masks/i);
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(running.model.onCancel).toHaveBeenCalledTimes(1);
    cleanup();
    const failed = setup({ model: idleModel({ disabledReason: null, error: 'Describe step: the key was refused.', canRetry: true }) });
    expect(screen.getByRole('alert').textContent).toContain('the key was refused');
    fireEvent.click(screen.getByRole('button', { name: 'Retry' }));
    expect(failed.model.onRetry).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('button', { name: 'Use local masks' })).toBeNull();
  });

  it('R66 Re-run decomposition asks first, names the models, up to 3 paid calls and the reset of the rows; Confirm then runs it', () => {
    const { model } = setup({ model: idleModel({ disabledReason: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Re-run decomposition' }));
    expect(model.onRerun).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('gpt-6-luna and gpt-image-2.5');
    expect(dialog.textContent).toMatch(/up to 3 calls/);
    expect(dialog.textContent).toMatch(/replaced by the new defaults/);
    fireEvent.click(within(dialog).getByRole('button', { name: 'Re-run' }));
    expect(model.onRerun).toHaveBeenCalledTimes(1);
  });

  it('R66 cancelling the question runs nothing', () => {
    const { model } = setup({ model: idleModel({ disabledReason: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Re-run decomposition' }));
    fireEvent.click(within(screen.getByRole('dialog')).getByRole('button', { name: 'Cancel' }));
    expect(model.onRerun).not.toHaveBeenCalled();
  });
});
