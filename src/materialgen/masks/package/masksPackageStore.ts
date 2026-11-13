import { MASKS_PACKAGE_CACHE_NAME, MASKS_PACKAGE_FILES, type PackageFile } from './masksPackageManifest';

/** The two methods of the Cache Storage entry that the package uses (a test gives a memory one). */
export interface PackageCache {
  match(url: string): Promise<Response | undefined>;
  put(url: string, response: Response): Promise<void>;
}

/** Masks-package R5: the stored package, kept in the origin's Cache Storage (the webview's own storage in the exe). Throws where Cache Storage does not exist. */
export function openMasksPackageCache(): Promise<PackageCache> {
  return caches.open(MASKS_PACKAGE_CACHE_NAME);
}

/** Masks-package R5: the package is installed when every file of it is stored. */
export async function isMasksPackageInstalled(cache: PackageCache, files: readonly PackageFile[] = MASKS_PACKAGE_FILES): Promise<boolean> {
  for (const file of files) {
    if ((await cache.match(file.url)) === undefined) return false;
  }
  return true;
}
