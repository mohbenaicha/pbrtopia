import { NearestFilter, type DataTexture } from 'three';
import { describe, expect, it } from 'vitest';
import { createMaskOverlay } from '../../../../src/materialgen/preview/material/createMaskOverlay';

const labels = (value: number, side = 2) => ({ width: side, height: side, channels: 1 as const, data: new Uint8Array(side * side).fill(value) });
const palette = [
  { label: 0, hex: '#ff0000', name: 'Brick' },
  { label: 3, hex: '#00aa55', name: 'Moss' },
];
const texel = (texture: DataTexture, index: number): number[] => [...(texture.image.data as Uint8Array).slice(index * 4, index * 4 + 4)];

describe('materialgen/preview R18 R40 the mask overlay', () => {
  it('R18 is off until labels, a palette and the switch are all there', () => {
    const overlay = createMaskOverlay();
    expect(overlay.uniforms.uMaskOn.value).toBe(0);
    overlay.setSettings({ on: true, opacity: 0.5, palette });
    expect(overlay.uniforms.uMaskOn.value).toBe(0); // no labels yet
    overlay.setLabels(labels(3));
    expect(overlay.uniforms.uMaskOn.value).toBe(1);
    overlay.setSettings({ on: false, opacity: 0.5, palette });
    expect(overlay.uniforms.uMaskOn.value).toBe(0);
    overlay.setSettings({ on: true, opacity: 0.5, palette: null });
    expect(overlay.uniforms.uMaskOn.value).toBe(0); // no masks record
  });

  it('R18 the label colour table has each palette colour at its label and nothing elsewhere', () => {
    const overlay = createMaskOverlay();
    overlay.setSettings({ on: true, opacity: 0.5, palette });
    const table = overlay.uniforms.uMaskPalette.value as DataTexture;
    expect(table.image.width).toBe(256);
    expect(texel(table, 0)).toEqual([255, 0, 0, 255]);
    expect(texel(table, 3)).toEqual([0, 170, 85, 255]);
    expect(texel(table, 1)[3]).toBe(0);
  });

  it('R40 the opacity is the mix amount, clamped to 0..1', () => {
    const overlay = createMaskOverlay();
    overlay.setSettings({ on: true, opacity: 0.25, palette });
    expect(overlay.uniforms.uMaskOpacity.value).toBe(0.25);
    overlay.setSettings({ on: true, opacity: 4, palette });
    expect(overlay.uniforms.uMaskOpacity.value).toBe(1);
  });

  it('R40 moving the opacity or the switch rebuilds no texture; a changed palette does', () => {
    const overlay = createMaskOverlay();
    overlay.setSettings({ on: true, opacity: 0.25, palette });
    const table = overlay.uniforms.uMaskPalette.value;
    overlay.setSettings({ on: true, opacity: 0.75, palette });
    overlay.setSettings({ on: false, opacity: 0.75, palette });
    expect(overlay.uniforms.uMaskPalette.value).toBe(table);
    overlay.setSettings({ on: false, opacity: 0.75, palette: [...palette!] });
    expect(overlay.uniforms.uMaskPalette.value).not.toBe(table);
  });

  it('R18 the labels are read exactly: nearest filtering, no mipmaps, and rebuilt only for a different picture', () => {
    const overlay = createMaskOverlay();
    const picture = labels(3);
    overlay.setLabels(picture);
    const first = overlay.uniforms.uMaskLabels.value as DataTexture;
    expect(first.magFilter).toBe(NearestFilter);
    expect(first.generateMipmaps).toBe(false);
    overlay.setLabels(picture);
    expect(overlay.uniforms.uMaskLabels.value).toBe(first);
    overlay.setLabels(labels(1));
    expect(overlay.uniforms.uMaskLabels.value).not.toBe(first);
  });

  it('R18 removing the labels turns the overlay off and releases their texture', () => {
    const overlay = createMaskOverlay();
    overlay.setSettings({ on: true, opacity: 0.5, palette });
    overlay.setLabels(labels(3));
    const texture = overlay.uniforms.uMaskLabels.value as DataTexture;
    let released = false;
    texture.addEventListener('dispose', () => (released = true));
    overlay.setLabels(undefined);
    expect(released).toBe(true);
    expect(overlay.uniforms.uMaskOn.value).toBe(0);
  });

  it('R18 the labels tile like the albedo', () => {
    const overlay = createMaskOverlay();
    overlay.setTile(3, 4);
    expect(overlay.uniforms.uMaskTile.value.toArray()).toEqual([3, 4]);
  });

  it('R18 the shaded material patch adds the uniforms and mixes the palette colour into the albedo only; the original hook still runs', () => {
    const overlay = createMaskOverlay();
    const calls: string[] = [];
    const material = { onBeforeCompile: () => void calls.push('previous'), customProgramCacheKey: () => 'base' };
    overlay.patchLitMaterial(material as never);
    const shader = { uniforms: {} as Record<string, unknown>, vertexShader: '#include <uv_vertex>', fragmentShader: '#include <map_fragment>' };
    (material.onBeforeCompile as unknown as (shader: unknown, renderer: unknown) => void).call(material, shader, undefined);
    expect(calls).toEqual(['previous']);
    expect(shader.uniforms['uMaskLabels']).toBe(overlay.uniforms.uMaskLabels);
    expect(shader.vertexShader).toContain('vMaskUv = uv * uMaskTile');
    expect(shader.fragmentShader).toContain('diffuseColor.rgb = mix(diffuseColor.rgb');
    expect(shader.fragmentShader.indexOf('#include <map_fragment>')).toBeLessThan(shader.fragmentShader.indexOf('diffuseColor.rgb = mix'));
    expect(material.customProgramCacheKey()).toContain('mask-overlay');
  });

  it('R18 disposing releases both textures', () => {
    const overlay = createMaskOverlay();
    overlay.setSettings({ on: true, opacity: 0.5, palette });
    overlay.setLabels(labels(3));
    let count = 0;
    for (const texture of [overlay.uniforms.uMaskLabels.value, overlay.uniforms.uMaskPalette.value] as DataTexture[]) texture.addEventListener('dispose', () => (count += 1));
    overlay.dispose();
    expect(count).toBe(2);
  });
});
