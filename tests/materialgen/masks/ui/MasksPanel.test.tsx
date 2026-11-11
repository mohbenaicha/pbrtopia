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
  const actions = {
    onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onResetRow: vi.fn(), onResetAll: vi.fn(),
    onFeather: vi.fn(), onOverlay: vi.fn(), onRequantise: vi.fn(),
  };
  const props: MasksPanelProps = {
    record: record(), table, tableProblem: null, stale: false, canWrite: true, busy: false, unusedLabels: new Set(), overlay: false,
    model: idleModel(), ...actions, ...overrides,
  };
  render(<MasksPanel {...props} />);
  return { ...actions, model: props.model };
}

describe('materialgen/masks MasksPanel (masks R48-R57 R22 R59)', () => {
  it('R49 with no masks the panel draws nothing: the masks come from the generation flow, not from buttons here', () => {
    setup({ record: null, table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.queryByRole('button')).toBeNull();
    expect(screen.queryByRole('alert')).toBeNull();
    expect(screen.queryByRole('combobox', { name: 'Components' })).toBeNull();
  });

  it('R48 one row per component in label order', () => {
    setup();
    const names = screen.getAllByRole('listitem').map((item) => item.querySelector('.mask-row__name')?.textContent);
    expect(names).toEqual(['Wall', 'Trim']);
  });

  it('R50 a released slider reports the label and the value', () => {
    const actions = setup();
    const slider = screen.getByLabelText('Roughness of Trim');
    fireEvent.pointerDown(slider);
    fireEvent.change(slider, { target: { value: '0.3' } });
    fireEvent.pointerUp(slider);
    expect(actions.onRowRough).toHaveBeenCalledWith(1, 0.3);
  });

  it('R52 R53 Reset all is disabled while every row is at its defaults, and reports when one is not', () => {
    setup();
    expect((screen.getByRole('button', { name: 'Reset all' }) as HTMLButtonElement).disabled).toBe(true);
    cleanup();
    const actions = setup({ record: record({ rows: [row(0, 'Wall', 'Brick', 0.1), row(1, 'Trim')] }) });
    fireEvent.click(screen.getByRole('button', { name: 'Reset all' }));
    expect(actions.onResetAll).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole('button', { name: 'Reset Wall' }));
    expect(actions.onResetRow).toHaveBeenCalledWith(0);
  });

  it('R54 the feather commits on release', () => {
    const actions = setup();
    const feather = screen.getByLabelText('Feather');
    fireEvent.pointerDown(feather);
    fireEvent.change(feather, { target: { value: '3' } });
    fireEvent.pointerUp(feather);
    expect(actions.onFeather).toHaveBeenCalledWith(3);
  });

  it('R55 the overlay switch reports its state and is not an edit (it works in a read-only project)', () => {
    const actions = setup({ canWrite: false });
    fireEvent.click(screen.getByRole('switch', { name: 'Overlay' }));
    expect(actions.onOverlay).toHaveBeenCalledWith(true);
  });

  it('R22 removed: a stored coverage figure from an older record never shows a warning', () => {
    setup({ record: { ...record(), coverage: 12 } as MasksRecord });
    expect(screen.queryByText(/matched the palette/)).toBeNull();
  });

  it('R59 stale masks show the badge, with Re-run decomposition and no local-masks button, while the rows stay', () => {
    setup({ stale: true, model: idleModel({ disabledReason: null }) });
    expect(screen.getByText('Albedo changed since the masks were made')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Re-run decomposition' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('button', { name: 'Use local masks' })).toBeNull();
    expect(screen.getByLabelText('Roughness of Wall')).toBeTruthy();
  });

  it('R71 rows whose label has no pixels are marked not used', () => {
    setup({ unusedLabels: new Set([1]) });
    expect(within(screen.getAllByRole('listitem')[1]!).getByText('Not used')).toBeTruthy();
    expect(within(screen.getAllByRole('listitem')[0]!).queryByText('Not used')).toBeNull();
  });

  it('R12 a read-only project disables every change but not the overlay', () => {
    setup({ canWrite: false });
    expect((screen.getByLabelText('Roughness of Wall') as HTMLInputElement).disabled).toBe(true);
    expect((screen.getByRole('button', { name: 'Re-quantise' }) as HTMLButtonElement).disabled).toBe(true);
    expect((screen.getByRole('switch', { name: 'Overlay' }) as HTMLInputElement).disabled).toBe(false);
  });

  it('R34 a base-material table that could not be loaded is said so and the rows are not offered', () => {
    setup({ table: null, tableProblem: 'The material list could not be loaded.' });
    expect(screen.getByText('The material list could not be loaded.')).toBeTruthy();
    expect(screen.queryByLabelText('Roughness of Wall')).toBeNull();
  });

  it('R25 there is no Source choice and no Components count: the masks come only from the decomposition picture; Re-run is off with the reason when the models are missing', () => {
    setup();
    expect(screen.queryByRole('combobox', { name: 'Components' })).toBeNull();
    expect(screen.queryByRole('radio')).toBeNull();
    expect((screen.getByRole('button', { name: 'Re-run decomposition' }) as HTMLButtonElement).disabled).toBe(true);
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

  it('R66 Re-run decomposition asks first, names the models, the paid calls and the reset of the rows; Confirm then runs it', () => {
    const { model } = setup({ model: idleModel({ disabledReason: null }) });
    fireEvent.click(screen.getByRole('button', { name: 'Re-run decomposition' }));
    expect(model.onRerun).not.toHaveBeenCalled();
    const dialog = screen.getByRole('dialog');
    expect(dialog.textContent).toContain('gpt-6-luna and gpt-image-2.5');
    expect(dialog.textContent).toMatch(/up to 4 calls/);
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
