// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { MapsState } from '@mat/maps';
import { parseBaseMaterials, type MasksRecord } from '@mat/masks';
import { MasksControls } from '../../../../../src/materialgen/app/panels/masks/MasksControls';
import type { MasksPanelPorts } from '../../../../../src/materialgen/app/panels/masks/useMasksPanel';

afterEach(cleanup);

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]] });
const state: MapsState = { size: 256, maps: {} };
const stored: MasksRecord = {
  source: 'model',
  palette: [{ label: 0, hex: '#FF0000', name: 'red' }],
  feather: 1,
  rows: [{ label: 0, name: 'Wall', description: '', location: '', defaultMaterial: 'Brick', top3: ['Brick'], matchKind: 'colour', material: 'Brick', rough: 0.8, metal: 0 }],
};

const ports = (masksRecord: MasksPanelPorts['masksRecord']): MasksPanelPorts => ({
  state, masksRecord, canWrite: true, controller: { commitMasks: vi.fn(async () => true), refuse: vi.fn() }, readBlob: async () => null, loadTable: async () => table,
  model: { disabledReason: 'off', running: false, error: null, canRetry: false, modelNames: '', onCreate: vi.fn(), onRerun: vi.fn(), onCancel: vi.fn(), onRetry: vi.fn() },
});

describe('materialgen/app MasksControls (masks R48 R49)', () => {
  it('R49 with no masks record it draws nothing and loads nothing', () => {
    const loadTable = vi.fn(async () => table);
    const { container } = render(<MasksControls {...ports(undefined)} loadTable={loadTable} />);
    expect(container.innerHTML).toBe('');
    expect(loadTable).not.toHaveBeenCalled();
  });

  it('R48 R49 with a masks record it shows the Feather slider, a swatch per component (its block after a click) and the two buttons at the bottom', async () => {
    render(<MasksControls {...ports(stored as unknown as Record<string, unknown>)} />);
    await waitFor(() => expect(screen.getByRole('button', { name: 'Wall' })).toBeTruthy());
    fireEvent.click(screen.getByRole('button', { name: 'Wall' }));
    expect(screen.getByRole('group', { name: 'Wall' })).toBeTruthy();
    expect(screen.getByLabelText('Feather')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Reset all' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Re-run decomposition' })).toBeTruthy();
  });
});
