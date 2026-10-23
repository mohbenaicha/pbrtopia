import { Scene, type Camera, type PerspectiveCamera, type WebGLRenderer } from 'three';

interface FrameCameras {
  readonly active: Camera;
  readonly perspective: PerspectiveCamera;
  readonly projection: 'perspective' | 'orthographic';
}

// R14a: three draws a texture background as a box one unit wide around the camera, which an orthographic camera shows as a small cube
// instead of the sky. With the orthographic camera the backdrop is therefore drawn first in a scene of its own with the perspective
// camera (same orientation, so the sky matches), then the scene is drawn over it without clearing and without its own background.
export function createFrameRenderer(renderer: Pick<WebGLRenderer, 'render' | 'autoClear'>, scene: Scene, cameras: FrameCameras): () => void {
  const backdropScene = new Scene();

  return () => {
    const background = scene.background;
    const needsOwnPass = cameras.projection === 'orthographic' && background !== null && 'isTexture' in background;
    if (!needsOwnPass) {
      renderer.render(scene, cameras.active);
      return;
    }
    const autoClear = renderer.autoClear;
    backdropScene.background = background;
    backdropScene.backgroundRotation.copy(scene.backgroundRotation);
    backdropScene.backgroundBlurriness = scene.backgroundBlurriness;
    backdropScene.backgroundIntensity = scene.backgroundIntensity;
    scene.background = null;
    try {
      renderer.render(backdropScene, cameras.perspective);
      renderer.autoClear = false;
      renderer.render(scene, cameras.active);
    } finally {
      scene.background = background;
      renderer.autoClear = autoClear;
      backdropScene.background = null; // the texture belongs to the environment, not to this scene
    }
  };
}
