import { AmbientLight, Color, DirectionalLight, Mesh, MeshStandardMaterial, PerspectiveCamera, PMREMGenerator, Scene, SphereGeometry, SRGBColorSpace, WebGLRenderer } from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

/** The look of one ball: what the material table gives (roughness and metal 0 to 1, colour as sRGB bytes). */
export interface BallLook {
  rgb: readonly [number, number, number];
  roughness: number;
  metal: number;
}

export interface MaterialBallRenderer {
  /** Queues a ball; `deliver` gets its picture (a bitmap the renderer keeps and closes itself). The returned function withdraws a request not yet drawn. */
  request(key: string, look: BallLook, deliver: (picture: ImageBitmap) => void): () => void;
  dispose(): void;
}

export const BALLS_PER_FRAME = 8; // A10: never a long frame, however many tiles are in view
export const BALL_CACHE_SIZE = 400;
const BALL_PIXELS = 96;

interface Pending {
  key: string;
  look: BallLook;
  deliver: (picture: ImageBitmap) => void;
}

/**
 * Compositing R7, A10: one small offscreen renderer lighting a sphere (the same three lights and room environment for every ball, so roughness and metal show),
 * 8 balls per animation frame, an LRU of 400 bitmaps. It is disposed when the picker closes, losing its context at once so the third context is freed.
 */
export function createMaterialBallRenderer(): MaterialBallRenderer {
  const renderer = new WebGLRenderer({ antialias: true, alpha: true, preserveDrawingBuffer: false });
  renderer.setPixelRatio(1);
  renderer.setSize(BALL_PIXELS, BALL_PIXELS, false);
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = SRGBColorSpace;
  const pmrem = new PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  room.dispose();
  const scene = new Scene();
  scene.environment = environment.texture;
  const material = new MeshStandardMaterial();
  const geometry = new SphereGeometry(0.92, 48, 24);
  scene.add(new Mesh(geometry, material), new AmbientLight(0xffffff, 0.35));
  const key = new DirectionalLight(0xffffff, 1.6);
  key.position.set(-2, 2.5, 3);
  const rim = new DirectionalLight(0xbcd0ff, 0.6);
  rim.position.set(3, -1, -2);
  scene.add(key, rim);
  const camera = new PerspectiveCamera(30, 1, 0.1, 20);
  camera.position.set(0, 0, 4.1);

  const queue: Pending[] = [];
  const cache = new Map<string, ImageBitmap>(); // insertion order is the recency order
  let frame = 0;
  let disposed = false;

  const remember = (name: string, picture: ImageBitmap): void => {
    const old = cache.get(name);
    if (old !== undefined) old.close();
    cache.delete(name);
    cache.set(name, picture);
    while (cache.size > BALL_CACHE_SIZE) {
      const oldest = cache.keys().next().value as string;
      cache.get(oldest)?.close();
      cache.delete(oldest);
    }
  };

  const drawOne = (item: Pending): void => {
    material.color.set(new Color().setRGB(item.look.rgb[0] / 255, item.look.rgb[1] / 255, item.look.rgb[2] / 255, SRGBColorSpace));
    material.roughness = item.look.roughness;
    material.metalness = item.look.metal;
    renderer.render(scene, camera);
    void createImageBitmap(renderer.domElement).then((picture) => {
      if (disposed) {
        picture.close();
        return;
      }
      remember(item.key, picture);
      item.deliver(picture);
    });
  };

  const run = (): void => {
    frame = 0;
    if (disposed) return;
    for (let count = 0; count < BALLS_PER_FRAME && queue.length > 0; count += 1) drawOne(queue.shift()!);
    if (queue.length > 0) frame = requestAnimationFrame(run);
  };

  return {
    request(name, look, deliver) {
      const cached = cache.get(name);
      if (cached !== undefined) {
        cache.delete(name); // most recent again
        cache.set(name, cached);
        deliver(cached);
        return () => undefined;
      }
      const item: Pending = { key: name, look, deliver };
      queue.push(item);
      if (frame === 0 && !disposed) frame = requestAnimationFrame(run);
      return () => {
        const index = queue.indexOf(item);
        if (index >= 0) queue.splice(index, 1);
      };
    },
    dispose() {
      if (disposed) return;
      disposed = true;
      cancelAnimationFrame(frame);
      queue.length = 0;
      for (const picture of cache.values()) picture.close();
      cache.clear();
      geometry.dispose();
      material.dispose();
      environment.dispose();
      pmrem.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
