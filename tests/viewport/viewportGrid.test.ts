import { Box3, Scene, ShaderMaterial, Vector3, type LineSegments, type Mesh } from 'three';
import { describe, expect, it } from 'vitest';
import { createCameraRig } from '../../src/viewport/cameraRig';
import { createViewportGrid, gridCellSize, visibleExtent } from '../../src/viewport/viewportGrid';

function setup() {
  const scene = new Scene();
  const rig = createCameraRig(1.5);
  const grid = createViewportGrid({ scene, rig });
  const floor = grid.object.children.find((child) => (child as Mesh).isMesh) as Mesh;
  return { scene, rig, grid, floor, uniforms: (floor.material as ShaderMaterial).uniforms };
}

const boxOfSize = (x: number, y: number, z: number, baseY = 0): Box3 => new Box3(new Vector3(0, baseY, 0), new Vector3(x, baseY + y, z));

describe('gridCellSize', () => {
  it('viewport-layout R24 the cell is the power of ten at or below one tenth of the longest side', () => {
    expect(gridCellSize(1.7)).toBe(0.1);
    expect(gridCellSize(10)).toBe(1);
    expect(gridCellSize(100)).toBe(10);
    expect(gridCellSize(0.5)).toBeCloseTo(0.01, 10);
    expect(gridCellSize(9.99)).toBe(0.1);
    expect(gridCellSize(1000)).toBe(100);
  });

  it('viewport-layout R24 a side that is zero, negative or not a number gives a cell of 1', () => {
    for (const side of [0, -3, Number.NaN, Number.POSITIVE_INFINITY]) expect(gridCellSize(side), String(side)).toBe(1);
  });
});

describe('viewport grid', () => {
  it('viewport-layout R24 it joins the viewport scene, shown by default', () => {
    const { scene, grid } = setup();
    expect(scene.children).toContain(grid.object);
    expect(grid.object.visible).toBe(true);
    expect(grid.isVisible()).toBe(true);
  });

  it('viewport-layout R24 the model sets the cell size and puts the grid at the lowest point of its box', () => {
    const { grid, uniforms } = setup();
    grid.setBounds(boxOfSize(1.0, 1.7, 0.5, -0.3));
    expect(uniforms['uCell']!.value).toBe(0.1);
    expect(grid.object.position.y).toBeCloseTo(-0.3, 10);
    grid.setBounds(null);
    expect(uniforms['uCell']!.value).toBe(1);
    expect(grid.object.position.y).toBe(0);
  });

  it('viewport-layout R24 setVisible shows and hides it', () => {
    const { grid } = setup();
    grid.setVisible(false);
    expect(grid.object.visible).toBe(false);
    expect(grid.isVisible()).toBe(false);
    grid.setVisible(true);
    expect(grid.object.visible).toBe(true);
  });

  it('viewport-layout R24 it follows the orbit target and fades over units of the visible extent, the same in both projections', () => {
    const { rig, grid, floor, uniforms } = setup();
    rig.target.set(3, 0, -2);
    rig.placeCamera(new Vector3(0.4, 0.5, 1), 8);
    grid.update();
    const extent = visibleExtent(rig);
    expect(uniforms['uFadeStart']!.value).toBeCloseTo(extent, 8);
    expect(uniforms['uFadeEnd']!.value).toBeGreaterThan(extent);
    expect((uniforms['uCenter']!.value as Vector3).toArray()).toEqual([3, 0, -2]);
    expect(grid.object.position.x).toBe(3);
    expect(grid.object.position.z).toBe(-2);
    expect(floor.scale.x).toBeGreaterThanOrEqual(uniforms['uFadeEnd']!.value as number);
    rig.setProjection('orthographic');
    expect(visibleExtent(rig)).toBeCloseTo(extent, 8);
  });

  it('viewport-layout R24 the two axis lines stay on the world axes when the orbit target moves: X on z = 0, Z on x = 0, both still reaching the target', () => {
    const { rig, grid } = setup();
    rig.target.set(3, 0, -2);
    rig.placeCamera(new Vector3(0.4, 0.5, 1), 8);
    grid.update();
    grid.object.updateMatrixWorld(true);
    const worldPoints = (name: string): Vector3[] => {
      const line = grid.object.getObjectByName(name) as LineSegments;
      const position = line.geometry.getAttribute('position');
      return Array.from({ length: position.count }, (_, index) => new Vector3().fromBufferAttribute(position, index).applyMatrix4(line.matrixWorld));
    };
    const axisX = worldPoints('axis-x');
    const axisZ = worldPoints('axis-z');
    for (const point of axisX) expect(point.z).toBeCloseTo(0, 8);
    for (const point of axisZ) expect(point.x).toBeCloseTo(0, 8);
    expect(Math.min(...axisX.map((point) => point.x))).toBeLessThan(3);
    expect(Math.max(...axisX.map((point) => point.x))).toBeGreaterThan(3);
    expect(Math.min(...axisZ.map((point) => point.z))).toBeLessThan(-2);
    expect(Math.max(...axisZ.map((point) => point.z))).toBeGreaterThan(-2);
  });

  it('viewport-layout R24 it fades with the camera: moving away widens it in step with the extent', () => {
    const { rig, grid, uniforms } = setup();
    rig.placeCamera(new Vector3(0, 0, 1), 4);
    grid.update();
    const near = uniforms['uFadeEnd']!.value as number;
    rig.placeCamera(new Vector3(0, 0, 1), 8);
    grid.update();
    expect(uniforms['uFadeEnd']!.value as number).toBeCloseTo(near * 2, 8);
  });

  it('viewport-layout R24 the picture a thumbnail takes is drawn without the grid, which comes back after', () => {
    const { grid } = setup();
    let shownWhileDrawing: boolean | null = null;
    grid.drawWithoutGrid(() => {
      shownWhileDrawing = grid.object.visible;
    });
    expect(shownWhileDrawing).toBe(false);
    expect(grid.object.visible).toBe(true);
  });

  it('viewport-layout R24 a grid that is hidden stays hidden around a thumbnail, and a failing draw still restores it', () => {
    const { grid } = setup();
    grid.setVisible(false);
    grid.drawWithoutGrid(() => undefined);
    expect(grid.object.visible).toBe(false);
    grid.setVisible(true);
    expect(() =>
      grid.drawWithoutGrid(() => {
        throw new Error('draw failed');
      }),
    ).toThrow('draw failed');
    expect(grid.object.visible).toBe(true);
  });

  it('viewport-layout R24 dispose takes it out of the scene', () => {
    const { scene, grid } = setup();
    grid.dispose();
    expect(scene.children).not.toContain(grid.object);
  });
});

describe('viewport grid: hide (generate R37)', () => {
  it('generate R37 hide() takes the grid out of a picture and the function it returns puts it back as it was', () => {
    const { grid } = setup();
    const restore = grid.hide();
    expect(grid.object.visible).toBe(false);
    restore();
    expect(grid.object.visible).toBe(true);
  });

  it('generate R37 a grid that was switched off stays off after hide() and its restore', () => {
    const { grid } = setup();
    grid.setVisible(false);
    grid.hide()();
    expect(grid.object.visible).toBe(false);
  });
});
