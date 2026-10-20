export type AtlasKey = '1K' | '2K' | '4K';

export interface AtlasSizeOption {
  key: AtlasKey;
  sizePx: number; // the square side of the atlas sent to the model
}

const ATLAS_SIZES: readonly AtlasSizeOption[] = [{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }, { key: '4K', sizePx: 4096 }];

export const DEFAULT_ATLAS_KEY: AtlasKey = '2K';

// R16: the atlas sizes the device can make; they do not depend on the model.
export const listAtlasSizes = (maxTextureSize: number): AtlasSizeOption[] => ATLAS_SIZES.filter((option) => option.sizePx <= maxTextureSize).map((option) => ({ ...option }));
