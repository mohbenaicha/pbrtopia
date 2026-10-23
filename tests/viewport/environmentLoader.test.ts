import type { WebGLRenderer } from 'three';
import { beforeEach, describe, expect, it, vi } from 'vitest';

// No GL context here: three's prefilter generator and the .hdr loader are replaced by recorders, so only this module's own decisions are checked.
const fake = vi.hoisted(() => ({
  targets: [] as { texture: object; dispose: () => void }[],
  equirects: [] as { mapping: number; dispose: () => void }[],
  generatorDisposed: 0,
  loadedUrls: [] as string[],
  roomsDisposed: 0,
  failLoad: false,
}));

vi.mock('three', async (importOriginal) => {
  const actual = await importOriginal<typeof import('three')>();
  class FakePmremGenerator {
    fromScene() {
      const target = { texture: {}, dispose: vi.fn() };
      fake.targets.push(target);
      return target;
    }
    fromEquirectangular() {
      const target = { texture: {}, dispose: vi.fn() };
      fake.targets.push(target);
      return target;
    }
    dispose() {
      fake.generatorDisposed += 1;
    }
  }
  return { ...actual, PMREMGenerator: FakePmremGenerator };
});

vi.mock('three/examples/jsm/loaders/RGBELoader.js', () => ({
  RGBELoader: class {
    async loadAsync(url: string) {
      fake.loadedUrls.push(url);
      if (fake.failLoad) throw new Error('network down');
      const equirect = { mapping: 0, dispose: vi.fn() };
      fake.equirects.push(equirect);
      return equirect;
    }
  },
}));

vi.mock('three/examples/jsm/environments/RoomEnvironment.js', () => ({
  RoomEnvironment: class {
    dispose() {
      fake.roomsDisposed += 1;
    }
  },
}));

const { EquirectangularReflectionMapping } = await import('three');
const { createEnvironmentLoader } = await import('../../src/viewport/environmentLoader');

const renderer = {} as WebGLRenderer;

describe('createEnvironmentLoader', () => {
  beforeEach(() => {
    fake.targets.length = 0;
    fake.equirects.length = 0;
    fake.generatorDisposed = 0;
    fake.loadedUrls.length = 0;
    fake.roomsDisposed = 0;
    fake.failLoad = false;
  });

  it('viewport-layout R14 the built-in studio is lit from the generated room, needs no file and has no backdrop', async () => {
    const loader = createEnvironmentLoader(renderer);
    const entry = await loader.load('studio');
    expect(entry.backdrop).toBeNull();
    expect(entry.light).toBe(fake.targets[0]!.texture);
    expect(fake.loadedUrls).toEqual([]);
    expect(fake.roomsDisposed).toBe(1);
  });

  it('viewport-layout R14a a catalog HDRI loads its .hdr file as an equirectangular sky that is both the light source and the backdrop', async () => {
    const loader = createEnvironmentLoader(renderer);
    const entry = await loader.load('venice_sunset');
    expect(fake.loadedUrls).toEqual([expect.stringMatching(/hdri\/venice_sunset\.hdr$/)]);
    expect(fake.equirects[0]!.mapping).toBe(EquirectangularReflectionMapping);
    expect(entry.backdrop).toBe(fake.equirects[0]);
    expect(entry.light).toBe(fake.targets[0]!.texture);
  });

  it('viewport-layout R14 an id that is not in the catalog is refused without fetching anything', async () => {
    const loader = createEnvironmentLoader(renderer);
    await expect(loader.load('../secret')).rejects.toThrow('Unknown HDRI "../secret"');
    await expect(loader.load('')).rejects.toThrow('Unknown HDRI');
    expect(fake.loadedUrls).toEqual([]);
  });

  it('viewport-layout R14 a file that fails to load rejects, so the settings keep the current light', async () => {
    fake.failLoad = true;
    const loader = createEnvironmentLoader(renderer);
    await expect(loader.load('overcast_soil_puresky')).rejects.toThrow('network down');
  });

  it('viewport-layout R14 dispose frees every target and sky it made and the generator, once', async () => {
    const loader = createEnvironmentLoader(renderer);
    await loader.load('studio');
    await loader.load('moonless_golf');
    loader.dispose();
    expect(fake.targets.every((target) => (target.dispose as ReturnType<typeof vi.fn>).mock.calls.length === 1)).toBe(true);
    expect(fake.equirects.every((equirect) => (equirect.dispose as ReturnType<typeof vi.fn>).mock.calls.length === 1)).toBe(true);
    expect(fake.generatorDisposed).toBe(1);
    loader.dispose();
    expect(fake.targets.every((target) => (target.dispose as ReturnType<typeof vi.fn>).mock.calls.length === 1)).toBe(true);
  });
});
