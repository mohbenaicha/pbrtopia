import { describe, expect, it } from 'vitest';
import { MAP_KINDS, SLOTS, isShownAsCard, kindsOfSlot, slotOfKind } from '@mat/maps/mapKinds';

describe('materialgen/maps R1 R2 slots and kinds', () => {
  it('R1 there are six slots in the order Color, Normal, Metal-Roughness, Height, Occlusion, Decomposition', () => {
    expect([...SLOTS]).toEqual(['color', 'normal', 'metalRoughness', 'height', 'occlusion', 'decomposition']);
  });

  it('R1 the first five slots are shown as cards and Decomposition is hidden', () => {
    expect(SLOTS.filter(isShownAsCard)).toEqual(['color', 'normal', 'metalRoughness', 'height', 'occlusion']);
  });

  it('R2 the kinds are albedo, diffuse, normal, rough, metal, height, ao and labels', () => {
    expect([...MAP_KINDS].sort()).toEqual(['albedo', 'ao', 'diffuse', 'height', 'labels', 'metal', 'normal', 'rough']);
  });

  it('R2 albedo and diffuse belong to Color; rough and metal to Metal-Roughness; labels to Decomposition', () => {
    expect(slotOfKind('albedo')).toBe('color');
    expect(slotOfKind('diffuse')).toBe('color');
    expect(slotOfKind('rough')).toBe('metalRoughness');
    expect(slotOfKind('metal')).toBe('metalRoughness');
    expect(slotOfKind('ao')).toBe('occlusion');
    expect(slotOfKind('labels')).toBe('decomposition');
  });

  it('R2 only Metal-Roughness holds two kinds at once; every other slot holds one map', () => {
    expect(kindsOfSlot('metalRoughness')).toEqual(['rough', 'metal']);
    expect(kindsOfSlot('color')).toEqual(['albedo', 'diffuse']);
    expect(kindsOfSlot('normal')).toEqual(['normal']);
  });
});
