import { describe, expect, it } from 'vitest';
import { createDefaultEditValues } from '../../../../src/materialgen/imageops/filters/editControls';
import { computeLumaRange, srgbToLinear } from '../../../../src/materialgen/imageops/filters/lumaRange';
import { planSpatialPasses } from '../../../../src/materialgen/imageops/filters/spatialPlan';

describe('imageops spatial pass plan (R20, R15)', () => {
  it('R15 with every control at its default no pass runs', () => {
    for (const kind of ['albedo', 'rough', 'metal', 'ao', 'height', 'normal'] as const) expect(planSpatialPasses(kind, createDefaultEditValues(kind))).toEqual([]);
  });

  it('R20 passes run in the order blur, denoise, sharpness, highpass, clarity, edge emphasis, contrast by scale', () => {
    const values = {
      ...createDefaultEditValues('height'), contrastLow: 2, edgeEmphasis: 1, clarity: 1, highpass: 1, sharpness: 1, denoise: 1, blur: 3,
    };
    expect(planSpatialPasses('height', values).map((pass) => pass.mode)).toEqual(['blur', 'denoise', 'sharpness', 'highpass', 'clarity', 'edge', 'scale']);
  });

  it('R20 each pass carries its amount', () => {
    const plan = planSpatialPasses('albedo', { ...createDefaultEditValues('albedo'), blur: 3, sharpness: 1 });
    expect(plan).toEqual([{ mode: 'blur', amount: 3 }, { mode: 'sharpness', amount: 1 }]);
  });

  it('R20 contrast by scale runs when any of its three bands is away from 1, and carries all three', () => {
    const plan = planSpatialPasses('rough', { ...createDefaultEditValues('rough'), contrastMid: 2 });
    expect(plan).toEqual([{ mode: 'scale', amount: 0, bands: [1, 2, 1] }]);
  });

  it('R22 a normal map plans denoise and the mixin only, even if other values are set', () => {
    expect(planSpatialPasses('normal', { denoise: 1, blur: 5, sharpness: 2 })).toEqual([{ mode: 'denoise', amount: 1 }]);
  });

  it('R82 R83 the colour mixin is a pass of a normal map, after denoise, carrying its amount; at 0 there is none', () => {
    expect(planSpatialPasses('normal', { denoise: 1, albedoMix: 0.5 })).toEqual([{ mode: 'denoise', amount: 1 }, { mode: 'mix', amount: 0.5 }]);
    expect(planSpatialPasses('normal', { albedoMix: 0 })).toEqual([]);
    expect(planSpatialPasses('height', { albedoMix: 1 })).toEqual([]); // only a normal map has it
  });
});

describe('imageops luma range for Normalise (R20)', () => {
  it('R20 a grey map has the range of its red channel', () => {
    const image = { width: 2, height: 1, channels: 1 as const, data: new Uint8Array([51, 179]) };
    const range = computeLumaRange(image, 'rough');
    expect(range.min).toBeCloseTo(0.2, 2);
    expect(range.max).toBeCloseTo(0.7, 2);
  });

  it('R4 albedo luma is measured in linear light (BT.709)', () => {
    const image = { width: 2, height: 1, channels: 3 as const, data: new Uint8Array([0, 0, 0, 255, 255, 255]) };
    expect(computeLumaRange(image, 'albedo')).toEqual({ min: 0, max: 1 });
    const mid = computeLumaRange({ width: 1, height: 1, channels: 3, data: new Uint8Array([128, 128, 128]) }, 'albedo');
    expect(mid.min).toBeCloseTo(srgbToLinear(128 / 255), 4);
  });

  it('R20 a flat map has min = max', () => {
    const range = computeLumaRange({ width: 2, height: 1, channels: 1, data: new Uint8Array([90, 90]) }, 'height');
    expect(range.min).toBe(range.max);
  });

  it('R4 the sRGB decode matches the standard curve', () => {
    expect(srgbToLinear(0)).toBe(0);
    expect(srgbToLinear(1)).toBeCloseTo(1, 6);
    expect(srgbToLinear(0.5)).toBeCloseTo(0.214, 3);
    expect(srgbToLinear(0.02)).toBeCloseTo(0.02 / 12.92, 6);
  });
});
