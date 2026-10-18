import { EquirectangularReflectionMapping, PMREMGenerator, type WebGLRenderer } from 'three';
import { RGBELoader } from 'three/examples/jsm/loaders/RGBELoader.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import type { EnvironmentEntry, EnvironmentLoader } from './environment';
import { hdriUrl } from './hdriCatalog';

// Builds the light for an HDRI id: the built-in studio from three's RoomEnvironment, any other catalog id from its .hdr file.
export function createEnvironmentLoader(renderer: WebGLRenderer): EnvironmentLoader {
  const generator = new PMREMGenerator(renderer);
  const rgbe = new RGBELoader();
  const owned: { dispose(): void }[] = []; // render targets and textures this loader made

  const loadStudio = (): EnvironmentEntry => {
    const room = new RoomEnvironment();
    const target = generator.fromScene(room, 0.04);
    room.dispose();
    owned.push(target);
    return { light: target.texture, backdrop: null };
  };

  const loadFile = async (url: string): Promise<EnvironmentEntry> => {
    const equirect = await rgbe.loadAsync(url);
    equirect.mapping = EquirectangularReflectionMapping;
    const target = generator.fromEquirectangular(equirect);
    owned.push(target, equirect);
    return { light: target.texture, backdrop: equirect };
  };

  return {
    async load(id) {
      if (id === 'studio') return loadStudio();
      const url = hdriUrl(id);
      if (!url) throw new Error(`Unknown HDRI "${id}"`);
      return loadFile(url);
    },
    dispose() {
      owned.forEach((texture) => texture.dispose());
      owned.length = 0;
      generator.dispose();
    },
  };
}
