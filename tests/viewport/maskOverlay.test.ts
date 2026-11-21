import { BoxGeometry, Group, Mesh, MeshBasicMaterial, NearestFilter, Raycaster, ShaderMaterial, type DataTexture } from 'three';
import { describe, expect, it } from 'vitest';
import { createMaskOverlay, type MaskOverlayState } from '../../src/viewport/maskOverlay';

const PALETTE = [{ hex: '#ff0000' }, { hex: '#00ff00' }, { hex: '#0000ff' }];
const LABELS = new Uint8Array([0, 1, 2, 1]);

const stateOf = (patch: Partial<MaskOverlayState> = {}): MaskOverlayState => ({ labels: LABELS, size: 2, palette: PALETTE, on: true, opacity: 0.5, highlight: null, ...patch });

function setup() {
  const root = new Group();
  const meshes = [new Mesh(new BoxGeometry(), new MeshBasicMaterial()), new Mesh(new BoxGeometry(), new MeshBasicMaterial())];
  meshes.forEach((mesh) => root.add(mesh));
  const overlay = createMaskOverlay(root);
  const copies = (): Mesh[] => {
    const found: Mesh[] = [];
    root.traverse((object) => {
      if (object.userData['isMaskOverlay'] === true) found.push(object as Mesh);
    });
    return found;
  };
  return { root, meshes, overlay, copies };
}

const uniformsOf = (mesh: Mesh): ShaderMaterial['uniforms'] => (mesh.material as ShaderMaterial).uniforms;

describe('createMaskOverlay (mask-mode R20)', () => {
  it('mask-mode R20 draws a translucent copy of every model mesh, sharing its geometry, never picked', () => {
    const { meshes, overlay, copies } = setup();
    overlay.set(stateOf());
    expect(copies()).toHaveLength(2);
    expect(copies().map((copy) => copy.geometry)).toEqual(meshes.map((mesh) => mesh.geometry));
    const hits: unknown[] = [];
    copies()[0]!.raycast(new Raycaster(), hits as never);
    expect(hits).toHaveLength(0);
  });

  it('mask-mode R20 the labels are sampled nearest, one byte each, and the palette by label, at the overlay opacity', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf({ opacity: 0.3 }));
    const uniforms = uniformsOf(copies()[0]!);
    const texture = uniforms['uLabels']!.value as DataTexture;
    expect(texture.magFilter).toBe(NearestFilter);
    expect(texture.minFilter).toBe(NearestFilter);
    expect(texture.generateMipmaps).toBe(false);
    expect([texture.image.width, texture.image.height]).toEqual([2, 2]);
    expect([...(texture.image.data as Uint8Array)]).toEqual([0, 1, 2, 1]);
    expect(uniforms['uOpacity']!.value).toBe(0.3);
    expect(uniforms['uPaletteSize']!.value).toBe(3);
    expect(uniforms['uPalette']!.value[0].toArray()).toEqual([1, 0, 0]);
    expect(uniforms['uPalette']!.value[2].toArray()).toEqual([0, 0, 1]);
  });

  it('mask-mode R20 the overlay has its own render order above the layer flash\'s and its own polygon offset, so the two never z-fight', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf());
    const material = copies()[0]!.material as ShaderMaterial;
    expect(copies()[0]!.renderOrder).toBeGreaterThan(1);
    expect(material.polygonOffset).toBe(true);
    expect(material.polygonOffsetFactor).toBeLessThan(0);
    expect(material.transparent).toBe(true);
    expect(material.depthWrite).toBe(false);
  });

  it('mask-mode R20 off, or with no labels, draws nothing; on again draws the copies', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf({ on: false }));
    expect(copies().every((copy) => !copy.visible)).toBe(true);
    overlay.set(stateOf({ on: true }));
    expect(copies().every((copy) => copy.visible)).toBe(true);
    overlay.set(null);
    expect(copies()).toHaveLength(0);
  });

  it('mask-mode R20 opacity and highlight change the uniforms without making new copies', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf());
    const before = copies();
    overlay.set(stateOf({ opacity: 0.8, highlight: 2 }));
    expect(copies()).toEqual(before);
    expect(uniformsOf(copies()[0]!)['uOpacity']!.value).toBe(0.8);
    expect(uniformsOf(copies()[0]!)['uHighlight']!.value).toBe(2);
    overlay.set(stateOf({ highlight: null }));
    expect(uniformsOf(copies()[0]!)['uHighlight']!.value).toBe(-1);
  });

  it('mask-mode R20 new labels replace the texture; the same labels keep it', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf());
    const first = uniformsOf(copies()[0]!)['uLabels']!.value;
    overlay.set(stateOf({ opacity: 0.1 }));
    expect(uniformsOf(copies()[0]!)['uLabels']!.value).toBe(first);
    overlay.set(stateOf({ labels: new Uint8Array([2, 2, 2, 2]) }));
    expect(uniformsOf(copies()[0]!)['uLabels']!.value).not.toBe(first);
  });

  it('mask-mode R20 dispose takes every copy away', () => {
    const { overlay, copies } = setup();
    overlay.set(stateOf());
    overlay.dispose();
    expect(copies()).toHaveLength(0);
  });

  it('mask-mode R20 the model\'s own overlay copies are not covered again', () => {
    const { root, meshes, overlay, copies } = setup();
    const wire = new Mesh(meshes[0]!.geometry, new MeshBasicMaterial());
    wire.userData['isWireframeOverlay'] = true;
    root.add(wire);
    overlay.set(stateOf());
    expect(copies()).toHaveLength(2);
  });
});
