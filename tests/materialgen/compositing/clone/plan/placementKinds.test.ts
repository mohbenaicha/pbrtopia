import { describe, expect, it } from 'vitest';
import { placementKinds } from '@mat/compositing/clone/plan/placementKinds';

describe('placementKinds (clone R14, R15)', () => {
  it('TestCloneR14_colour_and_roughness_metal_are_always_copied', () => {
    expect(placementKinds({ height: false, normal: false })).toEqual(['albedo', 'orm']);
  });

  it('TestCloneR14_height_is_copied_only_when_the_map_exists', () => {
    expect(placementKinds({ height: true, normal: false })).toEqual(['albedo', 'orm', 'height']);
  });

  it('TestCloneR15_a_normal_map_adds_the_slope_and_the_override', () => {
    expect(placementKinds({ height: false, normal: true })).toEqual(['albedo', 'orm', 'slope', 'override']);
  });

  it('TestCloneR14_every_map_present_lists_every_kind_once', () => {
    expect(placementKinds({ height: true, normal: true })).toEqual(['albedo', 'orm', 'height', 'slope', 'override']);
  });
});
