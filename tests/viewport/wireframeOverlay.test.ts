import { BoxGeometry, Group, Mesh, MeshBasicMaterial, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWireframeOverlay } from '../../src/viewport/wireframeOverlay';

function twoMeshModel() {
  const root = new Group();
  const a = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const b = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  root.add(a, b);
  return { root, a, b };
}

describe('wireframe overlay', () => {
  it('R14 it adds one wireframe child per mesh only while visible', () => {
    const { root, a, b } = twoMeshModel();
    const overlay = createWireframeOverlay(root);
    expect(a.children).toHaveLength(0);
    overlay.setVisible(true);
    expect(a.children).toHaveLength(1);
    expect(b.children).toHaveLength(1);
    overlay.setVisible(false);
    expect(a.children).toHaveLength(0);
    expect(b.children).toHaveLength(0);
  });

  it('R14 the overlay shares the mesh geometry, is a thin dark wireframe, and ignores the model look', () => {
    const { root, a } = twoMeshModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const [wire] = overlay.meshes();
    expect(wire!.geometry).toBe(a.geometry);
    const material = wire!.material as MeshBasicMaterial;
    expect(material.wireframe).toBe(true);
    expect(material.color.getHex()).toBe(0x000000);
    expect(material.polygonOffset).toBe(true);
    expect(wire!.userData['isWireframeOverlay']).toBe(true);
  });

  it('R14 showing twice adds nothing more, and a mesh added later is covered when it is shown again', () => {
    const { root, a } = twoMeshModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    overlay.setVisible(true);
    expect(a.children).toHaveLength(1);
    const late = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
    root.add(late);
    overlay.setVisible(true);
    expect(late.children).toHaveLength(1);
  });

  it('R14 dispose removes the overlay and frees only its own material, never the model geometry', () => {
    const { root, a } = twoMeshModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const wireMaterial = overlay.meshes()[0]!.material as Material;
    const disposeWire = vi.spyOn(wireMaterial, 'dispose');
    const disposeGeometry = vi.spyOn(a.geometry, 'dispose');
    overlay.dispose();
    expect(a.children).toHaveLength(0);
    expect(disposeWire).toHaveBeenCalledTimes(1);
    expect(disposeGeometry).not.toHaveBeenCalled();
  });
});
