import { describe, expect, it } from 'vitest';
import { createMapAdjustUniforms } from '@shared/viewport';
import { DEFAULT_PREVIEW_VALUES } from '@mat/storage';
import { createMaskOverlay } from '../../../../src/materialgen/preview/material/createMaskOverlay';
import { createFlatLooks } from '../../../../src/materialgen/preview/material/createFlatLooks';
import { createToolShading } from '../../../../src/materialgen/preview/material/createToolShading';
import { createPreviewMaterial } from '../../../../src/materialgen/preview/material/createPreviewMaterial';
import { FLAT_VIEWS, PREVIEW_SHADINGS } from '../../../../src/materialgen/preview/math/flatViews';

const grey = (value: number, side = 2) => ({ width: side, height: side, channels: 1 as const, data: new Uint8Array(side * side).fill(value) });
const setup = () => {
  const preview = createPreviewMaterial();
  const adjust = createMapAdjustUniforms();
  const overlay = createMaskOverlay();
  const flat = createFlatLooks(adjust, overlay.uniforms, createToolShading().uniforms);
  const sync = (): void => flat.sync(preview);
  return { preview, adjust, flat, sync, overlay };
};
const uniformsOf = (look: ReturnType<typeof createFlatLooks>, view: (typeof FLAT_VIEWS)[number]) => look.materialFor(view).uniforms;

describe('materialgen/preview R51 the view modes', () => {
  it('R51 the modes are Shaded, Albedo, Normal, Rough, Metal, Height and AO in that order', () => {
    expect(PREVIEW_SHADINGS).toEqual(['lit', 'albedo', 'normal', 'rough', 'metal', 'height', 'ao']);
    expect(FLAT_VIEWS).toEqual(['albedo', 'normal', 'rough', 'metal', 'height', 'ao']);
  });

  it('R51 every flat view uses the same tiling and the same displacement as the Shaded material', () => {
    const { preview, flat, sync } = setup();
    preview.bind({ height: grey(200) });
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, tilingX: 3, tilingY: 5, heightScale: 0.05, heightLevel: 0.25, heightContrast: 2 });
    sync();
    for (const view of FLAT_VIEWS) {
      const uniforms = uniformsOf(flat, view);
      expect(uniforms.uTile!.value.toArray()).toEqual([3, 5]);
      expect(uniforms.uDisplacementScale!.value).toBe(preview.material.displacementScale);
      expect(uniforms.uDisplacementBias!.value).toBe(preview.material.displacementBias);
      expect(uniforms.uHasHeight!.value).toBe(true);
      expect(uniforms.uHeight!.value).toBe(preview.material.displacementMap);
    }
  });

  it('R51 with no map bound at all the flat views still follow the tiling values, as the mask overlay does', () => {
    const { preview, flat, sync } = setup();
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, tilingX: 4, tilingY: 2 });
    sync();
    for (const view of FLAT_VIEWS) expect(uniformsOf(flat, view).uTile!.value.toArray()).toEqual([4, 2]);
  });

  it('R51 with no height map no flat view moves a vertex', () => {
    const { preview, flat, sync } = setup();
    preview.setValues({ ...DEFAULT_PREVIEW_VALUES, heightScale: 0.1, heightContrast: 3 });
    sync();
    for (const view of FLAT_VIEWS) {
      expect(uniformsOf(flat, view).uHasHeight!.value).toBe(false);
      expect(uniformsOf(flat, view).uDisplacementScale!.value).toBe(0);
    }
  });

  it('R51 each flat view is unlit and not tone mapped', () => {
    const { flat } = setup();
    for (const view of FLAT_VIEWS) expect(flat.materialFor(view).toneMapped).toBe(false);
  });
});

describe('materialgen/preview R52 what each flat view shows', () => {
  it('R52 Rough with no rough map is uniform grey 128; Metal black; AO white; Height grey 128', () => {
    const { flat, sync } = setup();
    sync();
    expect(uniformsOf(flat, 'rough').uHasMap!.value).toBe(false);
    expect(uniformsOf(flat, 'rough').uFallback!.value).toBeCloseTo(128 / 255, 6);
    expect(uniformsOf(flat, 'metal').uFallback!.value).toBe(0);
    expect(uniformsOf(flat, 'ao').uFallback!.value).toBe(1);
    expect(uniformsOf(flat, 'height').uHasMap!.value).toBe(false);
    expect(uniformsOf(flat, 'height').uFallback!.value).toBeCloseTo(128 / 255, 6);
  });

  it('R52 Rough reads the ORM green channel, Metal the blue one and AO the red one', () => {
    const { preview, flat, sync } = setup();
    preview.bind({ rough: grey(10) });
    sync();
    const orm = preview.textures.orm!;
    expect(uniformsOf(flat, 'rough').uMap!.value).toBe(orm);
    expect(uniformsOf(flat, 'rough').uChannel!.value.toArray()).toEqual([0, 1, 0]);
    expect(uniformsOf(flat, 'metal').uMap!.value).toBe(orm);
    expect(uniformsOf(flat, 'metal').uChannel!.value.toArray()).toEqual([0, 0, 1]);
    expect(uniformsOf(flat, 'ao').uMap!.value).toBe(orm);
    expect(uniformsOf(flat, 'ao').uChannel!.value.toArray()).toEqual([1, 0, 0]);
    expect(uniformsOf(flat, 'rough').uHasMap!.value).toBe(true);
  });

  it('R52 Height shows the height map and Albedo and Normal show their maps', () => {
    const { preview, flat, sync } = setup();
    preview.bind({ height: grey(90), albedo: { width: 2, height: 2, channels: 3, data: new Uint8Array(12) }, normal: { width: 2, height: 2, channels: 3, data: new Uint8Array(12) } });
    sync();
    expect(uniformsOf(flat, 'height').uMap!.value).toBe(preview.textures.height);
    expect(uniformsOf(flat, 'height').uChannel!.value.toArray()).toEqual([1, 0, 0]);
    expect(uniformsOf(flat, 'albedo').uMap!.value).toBe(preview.textures.albedo);
    expect(uniformsOf(flat, 'normal').uMap!.value).toBe(preview.textures.normal);
  });

  it('R52 a missing albedo shows sRGB 128 (linear 0.2158)', () => {
    const { flat, sync } = setup();
    sync();
    const colour = uniformsOf(flat, 'albedo').uFallbackColor!.value;
    expect(colour.r).toBeCloseTo(0.2158, 3);
    expect(uniformsOf(flat, 'albedo').uHasMap!.value).toBe(false);
  });

  it('R52 Rough, Metal and Normal share the Strength and Contrast uniforms of the Shaded view; Height and AO have none', () => {
    const { adjust, flat } = setup();
    expect(uniformsOf(flat, 'rough').uStrength).toBe(adjust.roughStrength);
    expect(uniformsOf(flat, 'rough').uContrast).toBe(adjust.roughContrast);
    expect(uniformsOf(flat, 'metal').uStrength).toBe(adjust.metalStrength);
    expect(uniformsOf(flat, 'metal').uContrast).toBe(adjust.metalContrast);
    expect(uniformsOf(flat, 'normal').uStrength).toBe(adjust.normalStrength);
    expect(uniformsOf(flat, 'normal').uContrast).toBe(adjust.normalContrast);
    expect(uniformsOf(flat, 'height').uStrength!.value).toBe(1);
    expect(uniformsOf(flat, 'ao').uContrast!.value).toBe(1);
  });

  it('R52 a flat view follows a map that is removed: it shows the default again', () => {
    const { preview, flat, sync } = setup();
    preview.bind({ rough: grey(10) });
    sync();
    preview.bind({});
    sync();
    expect(uniformsOf(flat, 'rough').uHasMap!.value).toBe(false);
  });

  it('R18 the Albedo view shares the mask overlay uniforms of the Shaded view; the other flat views have no overlay', () => {
    const { flat, overlay } = setup();
    expect(uniformsOf(flat, 'albedo').uMaskOn).toBe(overlay.uniforms.uMaskOn);
    expect(uniformsOf(flat, 'albedo').uMaskLabels).toBe(overlay.uniforms.uMaskLabels);
    expect(uniformsOf(flat, 'albedo').uMaskPalette).toBe(overlay.uniforms.uMaskPalette);
    expect(uniformsOf(flat, 'albedo').uMaskOpacity).toBe(overlay.uniforms.uMaskOpacity);
    for (const view of ['normal', 'rough', 'metal', 'height', 'ao'] as const) expect(uniformsOf(flat, view).uMaskOn).toBeUndefined();
  });

  it('R51 disposing the looks releases every material', () => {
    const { flat } = setup();
    let disposed = 0;
    for (const view of FLAT_VIEWS) flat.materialFor(view).addEventListener('dispose', () => (disposed += 1));
    flat.dispose();
    expect(disposed).toBe(FLAT_VIEWS.length);
  });
});
