import type { ModelFileCache } from '../embed/createLocalModelCache';
import { MASKS_PACKAGE_FILES, MODEL_PATH } from './masksPackageManifest';
import type { PackageCache } from './masksPackageStore';

const MODEL = MASKS_PACKAGE_FILES.find((file) => file.id === 'model')!;
const RUNTIME = MASKS_PACKAGE_FILES.find((file) => file.id === 'runtime')!;

/**
 * Masks-package R11: the model cache transformers.js asks. The model file is read from the stored package (a miss is "not found", never a fetch);
 * every other file comes from `base`, the small files that ship with the app.
 */
export function createPackagedModelCache(base: ModelFileCache, packageCache: PackageCache): ModelFileCache {
  return {
    match: (key) => (key.endsWith(`/${MODEL_PATH}`) ? packageCache.match(MODEL.url) : base.match(key)),
    put: async () => undefined,
  };
}

/** Masks-package R11: an object address of the stored runtime bytes, which onnxruntime loads; throws when the package is not stored (the matching then uses the keywords). */
export async function openRuntimeAddress(packageCache: PackageCache, createObjectUrl: (blob: Blob) => string = (blob) => URL.createObjectURL(blob)): Promise<string> {
  const response = await packageCache.match(RUNTIME.url);
  if (response === undefined) throw new Error('The masks package is not installed.');
  const bytes = await response.arrayBuffer();
  return createObjectUrl(new Blob([bytes], { type: 'application/wasm' }));
}
