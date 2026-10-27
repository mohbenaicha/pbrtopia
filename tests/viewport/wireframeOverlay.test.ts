import { BoxGeometry, Bone, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial, Skeleton, SkinnedMesh, Uint16BufferAttribute, type Material } from 'three';
import { describe, expect, it, vi } from 'vitest';
import { createWireframeOverlay } from '../../src/viewport/wireframeOverlay';

function twoMeshModel() {
  const root = new Group();
  const a = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  const b = new Mesh(new BoxGeometry(), new MeshBasicMaterial());
  root.add(a, b);
  return { root, a, b };
}

describe('wireframe overlay on a posed model', () => {
  function skinnedModel() {
    const geometry = new BoxGeometry();
    const count = geometry.getAttribute('position').count;
    geometry.setAttribute('skinIndex', new Uint16BufferAttribute(new Uint16Array(count * 4), 4));
    geometry.setAttribute('skinWeight', new Float32BufferAttribute(new Float32Array(count * 4).fill(0.25), 4));
    const bone = new Bone();
    const skeleton = new Skeleton([bone]);
    const mesh = new SkinnedMesh(geometry, new MeshBasicMaterial());
    mesh.add(bone);
    mesh.bind(skeleton);
    mesh.morphTargetInfluences = [0.5];
    mesh.morphTargetDictionary = { smile: 0 };
    const root = new Group();
    root.add(mesh);
    return { root, mesh, skeleton };
  }

  it('R30 the overlay of a skinned mesh is skinned with the same skeleton and bind matrix, so it keeps the pose', () => {
    const { root, mesh, skeleton } = skinnedModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const wire = overlay.meshes()[0] as SkinnedMesh;
    expect(wire.isSkinnedMesh).toBe(true);
    expect(wire.skeleton).toBe(skeleton);
    expect(wire.bindMatrix.equals(mesh.bindMatrix)).toBe(true);
  });

  it('R30 the overlay follows the morph weights of its mesh, even when they change later', () => {
    const { root, mesh } = skinnedModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    const wire = overlay.meshes()[0]!;
    expect(wire.morphTargetInfluences).toBe(mesh.morphTargetInfluences);
    expect(wire.morphTargetDictionary).toBe(mesh.morphTargetDictionary);
  });

  it('R30 an ordinary mesh keeps an ordinary overlay', () => {
    const { root } = twoMeshModel();
    const overlay = createWireframeOverlay(root);
    overlay.setVisible(true);
    expect((overlay.meshes()[0] as SkinnedMesh).isSkinnedMesh).toBeUndefined();
  });
});

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
