import { Color, NoColorSpace, RepeatWrapping, SRGBColorSpace, Texture, type Material } from 'three';

export type OverrideChannel = 'albedo' | 'normal' | 'rough' | 'metal';

export interface OverridePicture {
  id: string;
  bitmap: ImageBitmap; // the viewport owns it from here on
}

export interface MaterialPictures {
  set(materialIndex: number, channel: OverrideChannel, picture: OverridePicture | null): void; // null puts the file's own map and factor back
  /** normal-reauthor R12: swaps the image of the texture a shown picture uses, keeping the texture and its slots. False when no slot shows it: the bitmap then stays with the caller. */
  replaceBitmap(pictureId: string, bitmap: ImageBitmap): boolean;
  release(): void; // puts every original back and frees what the overrides made
}

// Where each channel lives on a material, and the factor that would tint or darken the picture.
const SLOTS: Record<OverrideChannel, { map: string; factor?: 'color' | 'roughness' | 'metalness' }> = {
  albedo: { map: 'map', factor: 'color' },
  normal: { map: 'normalMap' },
  rough: { map: 'roughnessMap', factor: 'roughness' },
  metal: { map: 'metalnessMap', factor: 'metalness' },
};

type Slot = (typeof SLOTS)[OverrideChannel];
type Shaded = Record<string, unknown>;

interface SavedSlot {
  map: Texture | null;
  factor?: number | Color | undefined;
}

interface Override {
  pictureId: string;
  original: SavedSlot;
  material: Shaded;
  slot: Slot;
}

interface HeldTexture {
  texture: Texture;
  users: number;
}

const closedBitmaps = new WeakSet<ImageBitmap>();

// A bitmap may be reached by several slots; it is closed once, whichever lets go last.
function closeBitmap(bitmap: ImageBitmap): void {
  if (closedBitmaps.has(bitmap)) return;
  closedBitmaps.add(bitmap);
  bitmap.close();
}

function saveSlot(material: Shaded, slot: Slot): SavedSlot {
  const factor = slot.factor ? material[slot.factor] : undefined;
  return { map: (material[slot.map] as Texture | null) ?? null, factor: factor instanceof Color ? factor.clone() : (factor as number | undefined) };
}

function restoreSlot(material: Shaded, slot: Slot, saved: SavedSlot): void {
  material[slot.map] = saved.map;
  if (slot.factor === 'color') (material['color'] as Color).copy(saved.factor as Color);
  else if (slot.factor) material[slot.factor] = saved.factor;
  (material as unknown as Material).needsUpdate = true; // a map that appears or goes recompiles the material
}

function showTexture(material: Shaded, slot: Slot, texture: Texture): void {
  material[slot.map] = texture;
  if (slot.factor === 'color') (material['color'] as Color).set(0xffffff); // the colour factor must not tint the picture
  else if (slot.factor) material[slot.factor] = 1; // the picture alone says how rough or metal each point is
  (material as unknown as Material).needsUpdate = true;
}

// Shows a picture in one channel of one of the model's source materials, in place of the file's own map. One picture is one texture, however many slots show it.
export function createMaterialPictures(materials: readonly Material[], onChanged: () => void): MaterialPictures {
  const overrides = new Map<string, Override>();
  const held = new Map<string, HeldTexture>();

  const unshown = new Map<string, OverridePicture>(); // slot key -> a picture its material cannot show; the bitmap is still owned here because another slot may show it
  const isHeld = (bitmap: ImageBitmap): boolean => [...held.values()].some((entry) => entry.texture.image === bitmap);
  const isInUse = (bitmap: ImageBitmap): boolean => isHeld(bitmap) || [...unshown.values()].some((picture) => picture.bitmap === bitmap);

  // Records (or, with null, forgets) the picture a slot cannot show, and closes what nothing uses any more.
  const setUnshown = (key: string, picture: OverridePicture | null): void => {
    const previous = unshown.get(key);
    unshown.delete(key);
    const surplus = picture !== null && held.get(picture.id) !== undefined && held.get(picture.id)?.texture.image !== picture.bitmap; // the held texture is the one in use
    if (picture !== null && !surplus) unshown.set(key, picture);
    if (picture !== null && surplus && !isInUse(picture.bitmap)) closeBitmap(picture.bitmap);
    if (previous && previous.bitmap !== picture?.bitmap && !isInUse(previous.bitmap)) closeBitmap(previous.bitmap);
  };

  const take = (picture: OverridePicture, channel: OverrideChannel): Texture => {
    const existing = held.get(picture.id);
    if (existing) {
      if (existing.texture.image !== picture.bitmap) closeBitmap(picture.bitmap); // the held texture is the one in use
      existing.users += 1;
      return existing.texture;
    }
    const texture = new Texture(picture.bitmap);
    texture.flipY = false; // read like a glTF image: the first row is v = 0
    texture.colorSpace = channel === 'albedo' ? SRGBColorSpace : NoColorSpace;
    texture.wrapS = texture.wrapT = RepeatWrapping; // as the glTF loader leaves a map without a sampler
    texture.needsUpdate = true;
    held.set(picture.id, { texture, users: 1 });
    return texture;
  };

  const letGo = (pictureId: string): void => {
    const entry = held.get(pictureId);
    if (!entry) return;
    entry.users -= 1;
    if (entry.users > 0) return;
    entry.texture.dispose();
    closeBitmap(entry.texture.image as ImageBitmap);
    held.delete(pictureId);
  };

  return {
    set(materialIndex, channel, picture) {
      const material = materials[materialIndex] as Shaded | undefined;
      const slot = SLOTS[channel];
      const key = `${materialIndex}:${channel}`;
      if (!material) {
        if (picture && !isInUse(picture.bitmap)) closeBitmap(picture.bitmap); // there is no such material
        return;
      }
      if (!(slot.map in material)) {
        setUnshown(key, picture); // this material cannot show it; the same bitmap may be handed to the next material
        return;
      }
      const current = overrides.get(key);
      if (picture === null) {
        if (!current) return;
        restoreSlot(material, slot, current.original);
        overrides.delete(key);
        letGo(current.pictureId);
        onChanged();
        return;
      }
      if (current?.pictureId === picture.id) {
        if (held.get(picture.id)?.texture.image !== picture.bitmap) closeBitmap(picture.bitmap);
        return;
      }
      const texture = take(picture, channel);
      const original = current?.original ?? saveSlot(material, slot);
      showTexture(material, slot, texture);
      overrides.set(key, { pictureId: picture.id, original, material, slot });
      if (current) letGo(current.pictureId);
      onChanged();
    },
    replaceBitmap(pictureId, bitmap) {
      const entry = held.get(pictureId);
      if (!entry) return false;
      const old = entry.texture.image as ImageBitmap;
      if (old === bitmap) return true;
      entry.texture.image = bitmap;
      entry.texture.needsUpdate = true;
      if (!isInUse(old)) closeBitmap(old);
      onChanged();
      return true;
    },
    release() {
      overrides.forEach((override) => {
        restoreSlot(override.material, override.slot, override.original);
        letGo(override.pictureId);
      });
      overrides.clear();
      const stranded = [...unshown.values()];
      unshown.clear();
      stranded.forEach((picture) => {
        if (!isInUse(picture.bitmap)) closeBitmap(picture.bitmap);
      });
    },
  };
}
