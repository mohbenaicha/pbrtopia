import { describe, expect, it } from 'vitest';
import type { MapRecord, MapsState } from '@mat/maps';
import { describeRegenerateWarning, listMapsToReplace } from '@mat/generation/run/describeRegenerate';
import { unassignMap } from '@mat/generation/plan/editPlan';
import { preset } from './runHarness';

const record: MapRecord = { originalKey: 'o', workingKey: 'w', undoKey: null, width: 1024, height: 1024 };
const state = (kinds: Array<keyof MapsState['maps']>): MapsState => ({ size: 1024, maps: Object.fromEntries(kinds.map((kind) => [kind, record])) });

describe('materialgen/generation R61 regenerate warning', () => {
  it('R61 a first generation has nothing to replace and no dialog', () => {
    expect(listMapsToReplace(preset('preset-1'), state([]), 'albedo')).toEqual([]);
    expect(describeRegenerateWarning([])).toBeNull();
  });

  it('R61 the warning names the originals of the maps in the plan that exist, in plan order', () => {
    const names = listMapsToReplace(preset('preset-1'), state(['height', 'albedo', 'normal']), 'albedo');
    expect(names).toEqual(['Albedo', 'Normal', 'Height']);
    expect(describeRegenerateWarning(['Albedo', 'Normal'])).toBe('Generating replaces the originals of Albedo, Normal and clears the undo of those maps. Maps you edited are replaced too.');
  });

  it('R61 a map not in the plan is not touched and not named: Height and Normal with originals stay out of an Albedo-only plan', () => {
    const albedoOnly = unassignMap(unassignMap({ ...preset('preset-1'), decomposition: null }, 'normal'), 'height');
    expect(listMapsToReplace(albedoOnly, state(['height', 'normal']), 'albedo')).toEqual([]);
    expect(listMapsToReplace(albedoOnly, state(['height', 'normal', 'albedo']), 'albedo')).toEqual(['Albedo']);
  });

  it('R61 in the Diffuse colour mode the colour map is looked for as diffuse and named Diffuse', () => {
    expect(listMapsToReplace(preset('preset-1'), state(['diffuse']), 'diffuse')).toEqual(['Diffuse']);
    expect(listMapsToReplace(preset('preset-1'), state(['albedo']), 'diffuse')).toEqual([]);
  });

  it('R61 the decomposition card replaces the Metal-Roughness labels, and only when it is included', () => {
    expect(listMapsToReplace(preset('preset-1'), state(['labels']), 'albedo')).toEqual(['Metal-Roughness']);
    expect(listMapsToReplace({ ...preset('preset-1'), decomposition: null }, state(['labels']), 'albedo')).toEqual([]);
  });
});
