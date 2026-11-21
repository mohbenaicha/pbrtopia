import { describe, expect, it, vi } from 'vitest';
import { createLocalModelCache } from '@shared/materialMasks/embed/createLocalModelCache';
import { createPackagedModelCache, openRuntimeAddress } from '@shared/materialMasks/package/createPackagedModelCache';
import { MASKS_PACKAGE_FILES } from '@shared/materialMasks/package/masksPackageManifest';
import type { PackageCache } from '@shared/materialMasks/package/masksPackageStore';

const MODEL = MASKS_PACKAGE_FILES[0]!;
const RUNTIME = MASKS_PACKAGE_FILES[1]!;

function cacheHolding(entries: Record<string, Uint8Array>): PackageCache {
  return {
    match: async (url) => (entries[url] === undefined ? undefined : new Response(entries[url] as BodyInit)),
    put: async () => undefined,
  };
}

describe('the model cache of the embedder worker (masks-package R11)', () => {
  it('TestR11_the_model_file_comes_from_the_stored_package_and_nothing_is_fetched', async () => {
    const fetchFile = vi.fn();
    const small = createLocalModelCache({ 'config.json': '/assets/config.json' }, fetchFile as never);
    const cache = createPackagedModelCache(small, cacheHolding({ [MODEL.url]: new Uint8Array([7, 7]) }));
    const response = await cache.match('https://hub.example/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx');
    expect([...new Uint8Array(await response!.arrayBuffer())]).toEqual([7, 7]);
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('TestR11_a_model_that_was_not_downloaded_is_not_found_and_the_network_is_not_asked', async () => {
    const fetchFile = vi.fn();
    const small = createLocalModelCache({}, fetchFile as never);
    const cache = createPackagedModelCache(small, cacheHolding({}));
    expect(await cache.match('https://hub.example/x/resolve/main/onnx/model_quantized.onnx')).toBeUndefined();
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('TestR11_the_small_model_files_still_come_from_the_app', async () => {
    const fetchFile = vi.fn(async () => new Response('{}'));
    const small = createLocalModelCache({ 'config.json': '/assets/config.json' }, fetchFile as never);
    const cache = createPackagedModelCache(small, cacheHolding({}));
    expect(await cache.match('https://hub.example/x/resolve/main/config.json')).toBeDefined();
    expect(fetchFile).toHaveBeenCalledWith('/assets/config.json');
  });

  it('TestR11_the_runtime_is_an_object_address_of_the_stored_bytes_and_a_missing_one_throws', async () => {
    const create = vi.fn(() => 'blob:runtime');
    expect(await openRuntimeAddress(cacheHolding({ [RUNTIME.url]: new Uint8Array([1]) }), create)).toBe('blob:runtime');
    expect(create).toHaveBeenCalledTimes(1);
    await expect(openRuntimeAddress(cacheHolding({}), create)).rejects.toThrow(/masks package/);
  });
});
