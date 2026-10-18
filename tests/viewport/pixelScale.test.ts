import { OrthographicCamera, PerspectiveCamera, Vector3 } from 'three';
import { describe, expect, it } from 'vitest';
import { pixelsFromWorldRadius, worldRadiusFromPixels } from '../../src/viewport/pixelScale';

const HEIGHT_PX = 600;

function perspective(): PerspectiveCamera {
  const camera = new PerspectiveCamera(40, 800 / 600, 0.01, 100);
  camera.position.set(0, 0, 5);
  camera.updateMatrixWorld(true);
  return camera;
}

function orthographic(zoom = 1): OrthographicCamera {
  const camera = new OrthographicCamera(-4, 4, 3, -3, 0.01, 100);
  camera.zoom = zoom;
  camera.position.set(0, 0, 5);
  camera.updateProjectionMatrix();
  camera.updateMatrixWorld(true);
  return camera;
}

describe('pixel and world size', () => {
  it('R17 in perspective a pixel covers 2 * depth * tan(fov / 2) / height world units', () => {
    const expected = (60 * 2 * 5 * Math.tan((20 * Math.PI) / 180)) / HEIGHT_PX;
    expect(worldRadiusFromPixels(perspective(), new Vector3(0, 0, 0), 60, HEIGHT_PX)).toBeCloseTo(expected, 6);
  });

  it('R17 in perspective the same pixel size is a bigger world size farther away, measured along the view and not by distance from the middle', () => {
    const camera = perspective();
    const near = worldRadiusFromPixels(camera, new Vector3(0, 0, 3), 60, HEIGHT_PX);
    const far = worldRadiusFromPixels(camera, new Vector3(0, 0, -5), 60, HEIGHT_PX);
    expect(far / near).toBeCloseTo(10 / 2, 5);
    expect(worldRadiusFromPixels(camera, new Vector3(2, 1, 0), 60, HEIGHT_PX)).toBeCloseTo(worldRadiusFromPixels(camera, new Vector3(0, 0, 0), 60, HEIGHT_PX), 6);
  });

  it('R17 in orthographic the size does not depend on depth, and zoom makes world units bigger on screen', () => {
    const camera = orthographic();
    expect(worldRadiusFromPixels(camera, new Vector3(0, 0, 4), 60, HEIGHT_PX)).toBeCloseTo((60 * 6) / HEIGHT_PX, 6);
    expect(worldRadiusFromPixels(camera, new Vector3(0, 0, -9), 60, HEIGHT_PX)).toBeCloseTo((60 * 6) / HEIGHT_PX, 6);
    expect(worldRadiusFromPixels(orthographic(2), new Vector3(), 60, HEIGHT_PX)).toBeCloseTo((60 * 3) / HEIGHT_PX, 6);
  });

  it('R17 pixels from a world radius is the inverse of world radius from pixels within 1% in both projections', () => {
    for (const camera of [perspective(), orthographic(), orthographic(3)]) {
      for (const point of [new Vector3(0, 0, 0), new Vector3(1, 2, -3), new Vector3(-1, 0, 2)]) {
        for (const pixels of [5, 60, 240]) {
          const world = worldRadiusFromPixels(camera, point, pixels, HEIGHT_PX);
          expect(Math.abs(pixelsFromWorldRadius(camera, point, world, HEIGHT_PX) - pixels) / pixels).toBeLessThan(0.01);
        }
      }
    }
  });
});
