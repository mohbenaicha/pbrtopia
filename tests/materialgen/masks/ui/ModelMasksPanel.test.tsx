// @vitest-environment jsdom
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { parseBaseMaterials, type MaskRow, type MasksRecord } from '@shared/materialMasks';
import { closeReveal, openReveal } from '@shared/tutorial';
import { ModelMasksPanel, type ModelMasksPanelProps } from '@mat/masks/ui/ModelMasksPanel';
import type { MasksModelControls } from '@mat/masks/ui/ModelRunParts';
import { REVEAL_MASK_SELECT } from '@mat/tutorial';
import { describeTooltipOf } from '../../../support/tooltipDescription';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const row = (label: number, name: string): MaskRow => ({
  label, name, description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick', 'Steel'], matchKind: 'keyword', material: 'Brick', rough: 0.8, metal: 0, height: 0,
});
const record = (): MasksRecord => ({
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }, { label: 1, hex: '#00FF00', name: 'green' }],
  feather: 1,
  rows: [row(0, 'Wall'), row(1, 'Trim')],
});
const idleModel = (patch: Partial<MasksModelControls> = {}): MasksModelControls => ({
  disabledReason: 'Needs the image models.', running: false, error: null, canRetry: false, modelNames: 'gpt-6-luna and gpt-image-2.5',
  onCreate: vi.fn(), onRerun: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn(), ...patch,
});

function setup(overrides: Partial<ModelMasksPanelProps> = {}) {
  const props: ModelMasksPanelProps = {
    record: record(), table, tableProblem: null, stale: false, canWrite: true, hasHeightMap: true, hasAlbedo: true, model: idleModel(),
    onRowMaterial: vi.fn(), onRowRough: vi.fn(), onRowMetal: vi.fn(), onRowHeight: vi.fn(), onRowMix: vi.fn(), onResetAll: vi.fn(), onFeather: vi.fn(), ...overrides,
  };
  render(<ModelMasksPanel {...props} />);
  return { model: props.model };
}
const swatch = (name: string): HTMLElement => screen.getByRole('button', { name });

describe('materialgen/masks ModelMasksPanel (masks R49 R59 R66-R68, the shared panel with material gen\'s parts)', () => {
  it('R49 Reset all and Re-run decomposition sit side by side at the bottom, after the selected block', () => {
    setup({ model: idleModel({ disabledReason: null }) });
    fireEvent.click(swatch('Wall'));
    const wall = screen.getByRole('group', { name: 'Wall' });
    const resetAll = screen.getByRole('button', { name: 'Reset all' });
    const rerun = screen.getByRole('button', { name: 'Re-run decomposition' });
    const follows = (a: Node, b: Node): boolean => (a.compareDocumentPosition(b) & Node.DOCUMENT_POSITION_FOLLOWING) !== 0;
    expect(follows(wall, resetAll)).toBe(true);
    expect(follows(resetAll, rerun)).toBe(true);
    expect(rerun.closest('.masks-panel__buttons')).toBe(resetAll.closest('.masks-panel__buttons')); // same row (a tooltip wrapper may sit between)
  });

  it('R49 Re-run decomposition is the primary (gold, dark text) button and Reset all is not', () => {
    setup({ model: idleModel({ disabledReason: null }) });
    expect(screen.getByRole('button', { name: 'Re-run decomposition' }).getAttribute('data-variant')).toBe('primary');
    expect(screen.getByRole('button', { name: 'Reset all' }).getAttribute('data-variant')).toBe('secondary');
  });

  it('R59 stale masks show the status line above the buttons, with one Re-run decomposition button', () => {
    setup({ stale: true, model: idleModel({ disabledReason: null }) });
    const message = screen.getByText('Albedo changed since the masks were made');
    expect(screen.getAllByRole('button', { name: 'Re-run decomposition' })).toHaveLength(1);
    expect(message.compareDocumentPosition(screen.getByRole('button', { name: 'Reset all' })) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(0);
  });

  it('R12 a read-only project disables Re-run decomposition too', () => {
    setup({ canWrite: false });
    expect((screen.getByRole('button', { name: 'Re-run decomposition' }) as HTMLButtonElement).disabled).toBe(true);
  });

  it('R25 Re-run is off with the reason when the models are missing', () => {
    setup();
    const rerun = screen.getByRole('button', { name: 'Re-run decomposition' }) as HTMLButtonElement;
    expect(rerun.disabled).toBe(true);
    expect(describeTooltipOf(rerun)).toBe('Re-run decomposition. Needs the image models.');
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

describe('materialgen/tutorial R22 the guided tour reveals the mask swatch block through the panel', () => {
  it('R22 the tour opens the first swatch\'s block and closes it again', () => {
    setup();
    expect(screen.queryByRole('group')).toBeNull();
    act(() => {
      openReveal(REVEAL_MASK_SELECT);
    });
    expect(screen.getByRole('group', { name: 'Wall' })).toBeTruthy();
    act(() => closeReveal(REVEAL_MASK_SELECT));
    expect(screen.queryByRole('group')).toBeNull();
  });
});
