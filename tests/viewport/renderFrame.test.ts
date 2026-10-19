import { Color, OrthographicCamera, PerspectiveCamera, Scene, Texture, type Camera } from 'three';
import { describe, expect, it } from 'vitest';
import { createFrameRenderer } from '../../src/viewport/renderFrame';

interface DrawnFrame {
  scene: Scene;
  camera: Camera;
  autoClear: boolean;
  background: Scene['background'];
}

function setup(projection: 'perspective' | 'orthographic') {
  const perspective = new PerspectiveCamera();
  const orthographic = new OrthographicCamera();
  const drawn: DrawnFrame[] = [];
  const renderer = {
    autoClear: true,
    render(scene: Scene, camera: Camera) {
      drawn.push({ scene, camera, autoClear: renderer.autoClear, background: scene.background });
    },
  };
  const scene = new Scene();
  const rig = { perspective, projection, get active() { return projection === 'perspective' ? perspective : orthographic; } };
  return { drawn, renderer, scene, perspective, orthographic, drawFrame: createFrameRenderer(renderer, scene, rig) };
}

describe('renderFrame', () => {
  it('R14a with the perspective camera the scene is drawn once with its own background', () => {
    const { drawn, scene, perspective, drawFrame } = setup('perspective');
    const sky = new Texture();
    scene.background = sky;
    drawFrame();
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatchObject({ scene, camera: perspective, background: sky, autoClear: true });
  });

  it('R14a with the orthographic camera and no backdrop the scene is drawn once', () => {
    const { drawn, scene, orthographic, drawFrame } = setup('orthographic');
    drawFrame();
    expect(drawn).toHaveLength(1);
    expect(drawn[0]).toMatchObject({ scene, camera: orthographic });
  });

  it('R14a with the orthographic camera the backdrop is drawn first with the perspective camera, then the scene without it and without clearing', () => {
    const { drawn, scene, perspective, orthographic, drawFrame } = setup('orthographic');
    const sky = new Texture();
    scene.background = sky;
    drawFrame();
    expect(drawn).toHaveLength(2);
    expect(drawn[0]?.scene).not.toBe(scene);
    expect(drawn[0]).toMatchObject({ camera: perspective, background: sky, autoClear: true });
    expect(drawn[1]).toMatchObject({ scene, camera: orthographic, background: null, autoClear: false });
  });

  it('R14a afterwards the background and the clearing are as they were, even when drawing throws', () => {
    const { renderer, scene, drawFrame } = setup('orthographic');
    const sky = new Texture();
    scene.background = sky;
    drawFrame();
    expect(scene.background).toBe(sky);
    expect(renderer.autoClear).toBe(true);
    renderer.render = () => {
      throw new Error('lost');
    };
    expect(() => drawFrame()).toThrow('lost');
    expect(scene.background).toBe(sky);
    expect(renderer.autoClear).toBe(true);
  });

  it('R14a the backdrop scene turns and blurs like the scene', () => {
    const { drawn, scene, drawFrame } = setup('orthographic');
    scene.background = new Texture();
    scene.backgroundRotation.y = 1.25;
    scene.backgroundBlurriness = 0.12;
    scene.backgroundIntensity = 0.8;
    drawFrame();
    const backdrop = drawn[0]?.scene as Scene;
    expect(backdrop.backgroundRotation.y).toBe(1.25);
    expect(backdrop.backgroundBlurriness).toBe(0.12);
    expect(backdrop.backgroundIntensity).toBe(0.8);
  });

  it('R14a a plain colour background is left to the scene, since it has no direction to get wrong', () => {
    const { drawn, scene, drawFrame } = setup('orthographic');
    scene.background = new Color('#101012');
    drawFrame();
    expect(drawn).toHaveLength(1);
    expect(drawn[0]?.scene).toBe(scene);
  });
});
