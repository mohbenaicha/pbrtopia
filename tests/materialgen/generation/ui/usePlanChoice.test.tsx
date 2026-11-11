// @vitest-environment jsdom
import { act, cleanup, renderHook } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { newMaterialRecord, type MaterialRecord } from '@mat/storage';
import { buildPresetPlan } from '@mat/generation/plan/presetPlans';
import { writePlan, writeSavedSetups } from '@mat/generation/plan/planRecord';
import { setImageSettings } from '@mat/generation/plan/editPlan';
import { usePlanChoice } from '@mat/generation/ui/usePlanChoice';
import type { SavedSetup } from '@mat/generation/plan/planTypes';
import { CATALOG, flush } from '../run/runHarness';

afterEach(cleanup);

const MAX_TEXTURE = 16384;
const base = (patch: Partial<MaterialRecord> = {}): MaterialRecord => ({ ...newMaterialRecord({ id: 'p1', name: 'Bricks', size: 1024, now: '2026-11-10T09:00:00.000Z' }), ...patch });
const preset = (id: string) => buildPresetPlan(id, CATALOG, MAX_TEXTURE)!;

/** The app-wide settings store: the saved setups it holds, and every list the hook wrote back. */
function fakeStore(initial: SavedSetup[] = []) {
  const written: unknown[] = [];
  const store = {
    loadAppSettings: vi.fn(async () => ({ savedSetups: writeSavedSetups(initial) }) as never),
    saveAppSettings: vi.fn(async (patch: { savedSetups?: unknown }) => {
      written.push(patch.savedSetups);
      return { ok: true as const, value: undefined };
    }),
  };
  return { store, written };
}

function mount(record: MaterialRecord, initial: SavedSetup[] = []) {
  const onEdit = vi.fn();
  const { store, written } = fakeStore(initial);
  const hook = renderHook(() => usePlanChoice({ record, catalog: CATALOG, maxTextureSize: MAX_TEXTURE, onEdit, store }));
  const applied = (call = 0): MaterialRecord => (onEdit.mock.calls[call]![0] as (r: MaterialRecord) => MaterialRecord)(record);
  const settled = async (): Promise<void> => {
    await act(async () => {
      await flush();
    });
  };
  return { ...hook, onEdit, applied, store, written, settled };
}

describe('materialgen/generation plan choice', () => {
  it('R70 a project with no saved plan starts on preset 1', () => {
    const { result } = mount(base());
    expect(result.current.entry).toBe('preset-1');
    expect(result.current.plan).toEqual(preset('preset-1'));
  });

  it('R2 R70 choosing a preset stores its plan and the select value in the record', () => {
    const { result, applied } = mount(base());
    act(() => result.current.choose('preset-3'));
    expect(applied()).toMatchObject({ presetId: 'preset-3', customPlan: writePlan(preset('preset-3')) });
  });

  it('R4 an edited plan that matches nothing is stored as Custom and keeps the edit', () => {
    const { result, applied } = mount(base());
    const edited = setImageSettings(preset('preset-1'), 1, { ...preset('preset-1').images[1]!.settings, quality: 'high' });
    act(() => result.current.replacePlan(edited));
    expect(applied()).toMatchObject({ presetId: 'custom', customPlan: writePlan(edited) });
  });

  it('R4 an edit back to a preset shows that preset again', () => {
    const { result, applied } = mount(base({ presetId: 'custom', customPlan: writePlan(preset('preset-2')) }));
    expect(result.current.entry).toBe('preset-2');
    act(() => result.current.replacePlan(preset('preset-1')));
    expect(applied().presetId).toBe('preset-1');
  });

  it('R20 saved setups come from the app settings, so a project that never saved one lists them; a stored plan equal to a saved setup shows that setup, and choosing one loads its plan', async () => {
    const saved = [{ name: 'Brick pass', plan: preset('preset-3') }];
    const record = base({ customPlan: writePlan(preset('preset-3')), presetId: 'preset-3' });
    const { result, applied, settled } = mount(record, saved);
    expect(result.current.saved).toEqual([]); // until the settings have loaded
    await settled();
    expect(result.current.entry).toBe('preset-3'); // a preset is named before a saved setup that equals it
    expect(result.current.saved.map((setup) => setup.name)).toEqual(['Brick pass']);
    act(() => result.current.choose('saved:Brick pass'));
    expect(applied().customPlan).toEqual(writePlan(preset('preset-3')));
  });

  it('R20 Save setup stores the plan in the app settings, not the project; a name already used is replaced in place, and Delete removes it', async () => {
    const { result, store, written, onEdit, settled } = mount(base(), [{ name: 'Brick pass', plan: preset('preset-2') }, { name: 'Other', plan: preset('preset-1') }]);
    await settled();
    act(() => result.current.saveSetup('Brick pass', preset('preset-3')));
    await settled();
    expect(written[0]).toEqual(writeSavedSetups([{ name: 'Brick pass', plan: preset('preset-3') }, { name: 'Other', plan: preset('preset-1') }])); // the replaced setup keeps its place
    act(() => result.current.deleteSetup('Other'));
    await settled();
    expect(written[1]).toEqual(writeSavedSetups([{ name: 'Brick pass', plan: preset('preset-3') }]));
    act(() => result.current.saveSetup('New one', preset('preset-1')));
    await settled();
    expect(written[2]).toEqual(writeSavedSetups([{ name: 'Brick pass', plan: preset('preset-3') }, { name: 'New one', plan: preset('preset-1') }]));
    expect(result.current.saved.map((setup) => setup.name)).toEqual(['Brick pass', 'New one']);
    expect(store.saveAppSettings).toHaveBeenCalledTimes(3);
    expect(onEdit).not.toHaveBeenCalled(); // the project record is untouched
  });

  it('R20 two saves in a row both land, and a save made before the settings have loaded does not drop the stored setups', async () => {
    const { result, written, settled } = mount(base(), [{ name: 'Old', plan: preset('preset-2') }]);
    act(() => {
      result.current.saveSetup('First', preset('preset-1'));
      result.current.saveSetup('Second', preset('preset-3'));
    });
    await settled();
    expect(written.at(-1)).toEqual(writeSavedSetups([{ name: 'Old', plan: preset('preset-2') }, { name: 'First', plan: preset('preset-1') }, { name: 'Second', plan: preset('preset-3') }]));
  });

  it('R70 a choice that names nothing changes nothing', () => {
    const { result, onEdit } = mount(base());
    act(() => result.current.choose('custom'));
    act(() => result.current.choose('saved:Gone'));
    expect(onEdit).not.toHaveBeenCalled();
  });
});
