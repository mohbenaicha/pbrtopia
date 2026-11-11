import { describe, expect, it } from 'vitest';
import { buildCardModel, colorKindOf, kindLabel } from '../../../../src/materialgen/maps/ui/buildCardModel';
import { changeSize, editMaps, placeMap } from '../../../../src/materialgen/maps/mapOperations';
import type { MapsState } from '../../../../src/materialgen/maps';

const empty: MapsState = { size: null, maps: {} };
const put = (state: MapsState, kind: Parameters<typeof placeMap>[1], key: string, more: Partial<Parameters<typeof placeMap>[2]> = {}): MapsState =>
  placeMap(state, kind, { originalKey: key, workingKey: key, width: 1024, height: 1024, ...more });

describe('materialgen/maps R4 colorKindOf and kindLabel', () => {
  it('R4 the Color slot keeps whichever kind holds its map, albedo by default', () => {
    expect(colorKindOf(empty.maps)).toBe('albedo');
    expect(colorKindOf(put(empty, 'diffuse', 'd1').maps)).toBe('diffuse');
  });

  it('R4 R44 the label of the colour map follows the colour mode; the other kinds have fixed names', () => {
    expect(kindLabel('albedo', 'albedo')).toBe('Albedo');
    expect(kindLabel('albedo', 'diffuse')).toBe('Diffuse');
    expect([kindLabel('normal', 'albedo'), kindLabel('rough', 'albedo'), kindLabel('metal', 'albedo'), kindLabel('height', 'albedo'), kindLabel('ao', 'albedo')]).toEqual(['Normal', 'Roughness', 'Metal', 'Height', 'Occlusion']);
  });
});

describe('materialgen/maps R44 buildCardModel', () => {
  it('R44 an empty card has one empty half and a disabled Undo', () => {
    const card = buildCardModel(empty, 'normal', 'albedo');
    expect(card.title).toBe('Normal');
    expect(card.halves).toHaveLength(1);
    expect(card.halves[0]).toMatchObject({ kind: 'normal', filled: false, workingKey: null, sizeText: null, sourceText: null, stale: false, canRestore: false });
    expect(card.undo).toMatchObject({ enabled: false, kinds: ['normal'] });
  });

  it('R44 a filled card gives the working key, the size as "S x S" and the source', () => {
    const generated = put(empty, 'albedo', 'a1', { source: { kind: 'generated' } });
    expect(buildCardModel(generated, 'color', 'albedo').halves[0]).toMatchObject({ filled: true, workingKey: 'a1', sizeText: '1024 x 1024', sourceText: 'Generated' });
    const dropped = put(empty, 'normal', 'n1', { source: { kind: 'dropped', name: 'brick.jpg' } });
    expect(buildCardModel(dropped, 'normal', 'albedo').halves[0]?.sourceText).toBe('Dropped: brick.jpg');
    const computed = put(empty, 'ao', 'o1', { source: { kind: 'computed' } });
    expect(buildCardModel(computed, 'occlusion', 'albedo').halves[0]?.sourceText).toBe('Computed');
  });

  it('R44 a card with a map that has no recorded source shows no source line', () => {
    expect(buildCardModel(put(empty, 'normal', 'n1'), 'normal', 'albedo').halves[0]?.sourceText).toBeNull();
  });

  it('R32 R44 a derived map whose source changed shows the stale badge', () => {
    let state = put(put(empty, 'normal', 'n1'), 'ao', 'o1', { derivedFrom: { kind: 'normal', key: 'n1' } });
    expect(buildCardModel(state, 'occlusion', 'albedo').halves[0]?.stale).toBe(false);
    state = editMaps(state, [{ kind: 'normal', workingKey: 'n2' }], 'Denoise');
    expect(buildCardModel(state, 'occlusion', 'albedo').halves[0]?.stale).toBe(true);
  });

  it('R19 Restore original is available only when the working key differs from the original', () => {
    let state = put(empty, 'albedo', 'a1');
    expect(buildCardModel(state, 'color', 'albedo').halves[0]?.canRestore).toBe(false);
    state = editMaps(state, [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    expect(buildCardModel(state, 'color', 'albedo').halves[0]?.canRestore).toBe(true);
  });

  it('R4 the Color card shows the map under whichever kind holds it and titles it by the colour mode', () => {
    const state = put(empty, 'albedo', 'a1');
    const card = buildCardModel(state, 'color', 'diffuse');
    expect(card.title).toBe('Diffuse');
    expect(card.halves[0]).toMatchObject({ kind: 'albedo', label: 'Diffuse', filled: true });
  });

  it('R42 R44 the Metal-Roughness card has two halves, Roughness then Metal, each with its own state', () => {
    const state = put(empty, 'rough', 'r1');
    const card = buildCardModel(state, 'metalRoughness', 'albedo');
    expect(card.title).toBe('Metal-Roughness');
    expect(card.halves.map((half) => [half.kind, half.label, half.filled])).toEqual([['rough', 'Roughness', true], ['metal', 'Metal', false]]);
  });
});

describe('materialgen/maps R47 the card Undo', () => {
  it('R47 is enabled with a tooltip "Undo <label>" naming the map when its map has an entry', () => {
    const state = editMaps(put(empty, 'albedo', 'a1'), [{ kind: 'albedo', workingKey: 'a2' }], 'Filter');
    expect(buildCardModel(state, 'color', 'albedo').undo).toMatchObject({ enabled: true, tooltip: 'Undo Filter (Albedo)', kinds: ['albedo'] });
  });

  it('R47 R70 lists the other live members of a group in the tooltip', () => {
    let state = put(put(empty, 'albedo', 'a1'), 'normal', 'n1');
    state = changeSize(state, 512, { albedo: 'a2', normal: 'n2' }, 'g1');
    expect(buildCardModel(state, 'normal', 'albedo').undo.tooltip).toBe('Undo Change size (Normal, Albedo)');
  });

  it('R47 the Metal-Roughness card undoes the entries of rough and metal together', () => {
    let state = put(put(empty, 'rough', 'r1'), 'metal', 'm1');
    state = editMaps(state, [{ kind: 'rough', workingKey: 'r2' }, { kind: 'metal', workingKey: 'm2' }], 'Mask commit');
    const undo = buildCardModel(state, 'metalRoughness', 'albedo').undo;
    expect(undo).toMatchObject({ enabled: true, kinds: ['rough', 'metal'] });
    expect(undo.tooltip).toBe('Undo Mask commit (Roughness, Metal)');
  });

  it('R47 the Metal-Roughness card is enabled when only one of its maps has an entry', () => {
    const state = editMaps(put(put(empty, 'rough', 'r1'), 'metal', 'm1'), [{ kind: 'metal', workingKey: 'm2' }], 'Filter');
    expect(buildCardModel(state, 'metalRoughness', 'albedo').undo.enabled).toBe(true);
  });
});
