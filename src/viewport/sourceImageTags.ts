import type { Texture } from 'three';
import type { GLTFLoaderPlugin, GLTFParser } from 'three/examples/jsm/loaders/GLTFLoader.js';

// The picture is shared by a texture and its clones through their Source, so the tag sits on the Source and every clone answers the same.
const imageIndexOfSource = new WeakMap<object, number>();

/** Notes which image of the GLB file (its images list) a texture shows. */
export function rememberSourceImage(texture: Texture, imageIndex: number): void {
  imageIndexOfSource.set(texture.source, imageIndex);
}

/** The index in the GLB file's images list of the picture a texture shows; undefined when it did not come from the file's own images. */
export function sourceImageIndexOf(texture: Texture): number | undefined {
  return imageIndexOfSource.get(texture.source);
}

/** A GLTFLoader plugin: once the file is read, every texture it made is tagged with the image it was made from (mesh edit R25). */
export function tagSourceImages(parser: GLTFParser): GLTFLoaderPlugin {
  return {
    name: 'PTA_source_image_tags',
    afterRoot() {
      const textureDefs = (parser.json as { textures?: { source?: number; extensions?: Record<string, { source?: number } | undefined> }[] }).textures ?? [];
      for (const [object, reference] of parser.associations) {
        const textureIndex = (reference as { textures?: number } | undefined)?.textures;
        if (textureIndex === undefined || !(object as Texture).isTexture) continue;
        const definition = textureDefs[textureIndex];
        const imageIndex = definition?.source ?? Object.values(definition?.extensions ?? {}).find((extension) => typeof extension?.source === 'number')?.source;
        if (typeof imageIndex === 'number') rememberSourceImage(object as Texture, imageIndex);
      }
      return null;
    },
  };
}
