import { afterEach, describe, expect, it, vi } from 'vitest';
import { MASKS_PACKAGE_CACHE_NAME, MASKS_PACKAGE_FILES } from '@shared/materialMasks/package/masksPackageManifest';
import { openMasksPackageCache } from '@shared/materialMasks/package/masksPackageStore';

afterEach(() => vi.unstubAllGlobals());

describe('material-masks-core masks package store', () => {
  it('material-masks-core R11 the package is stored in the one Cache Storage name of the two sites, with the shipped hashes unchanged', async () => {
    const open = vi.fn(async () => ({ match: async () => undefined, put: async () => undefined }));
    vi.stubGlobal('caches', { open });
    await openMasksPackageCache();
    expect(MASKS_PACKAGE_CACHE_NAME).toBe('pbrtopia-masks-package-v1');
    expect(open).toHaveBeenCalledWith('pbrtopia-masks-package-v1');
    expect(MASKS_PACKAGE_FILES.map((file) => file.sha256)).toEqual([
      'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
      'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39',
    ]);
  });
});
