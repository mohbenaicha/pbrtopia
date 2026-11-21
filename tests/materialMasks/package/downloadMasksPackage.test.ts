import { createHash } from 'node:crypto';
import { describe, expect, it, vi } from 'vitest';
import { downloadMasksPackage, type PackageProgress } from '@shared/materialMasks/package/downloadMasksPackage';
import type { PackageFile } from '@shared/materialMasks/package/masksPackageManifest';
import { isMasksPackageInstalled, type PackageCache } from '@shared/materialMasks/package/masksPackageStore';

const modelBytes = new Uint8Array([1, 2, 3, 4]);
const runtimeBytes = new Uint8Array([9, 8]);
const sha = (bytes: Uint8Array) => createHash('sha256').update(bytes).digest('hex');
const FILES: PackageFile[] = [
  { id: 'model', url: 'https://huggingface.co/x/model.onnx', bytes: 4, sha256: sha(modelBytes) },
  { id: 'runtime', url: 'https://cdn.jsdelivr.net/npm/y/runtime.wasm', bytes: 2, sha256: sha(runtimeBytes) },
];

function memoryCache(): PackageCache & { entries: Map<string, Response> } {
  const entries = new Map<string, Response>();
  return {
    entries,
    match: async (url) => entries.get(url)?.clone(),
    put: async (url, response) => void entries.set(url, response),
  };
}

function responseOf(bytes: Uint8Array, finalAddress: string): Response {
  const response = new Response(bytes as BodyInit);
  Object.defineProperty(response, 'url', { value: finalAddress });
  return response;
}

const servingEverything = vi.fn(async (url: string) => (url.includes('huggingface') ? responseOf(modelBytes, url) : responseOf(runtimeBytes, url)));

describe('downloadMasksPackage (masks-package R3-R5, R8, R9)', () => {
  it('TestR5_both_verified_files_are_stored_under_their_addresses_and_the_package_is_then_installed', async () => {
    const cache = memoryCache();
    const progress: PackageProgress[] = [];
    const outcome = await downloadMasksPackage({ cache, files: FILES, fetchFile: servingEverything as never }, { onProgress: (value) => progress.push(value) });
    expect(outcome).toEqual({ ok: true });
    expect([...cache.entries.keys()]).toEqual(FILES.map((file) => file.url));
    expect(await isMasksPackageInstalled(cache, FILES)).toBe(true);
    expect(progress[progress.length - 1]).toEqual({ loaded: 6, total: 6 });
  });

  it('TestR5_the_package_is_not_installed_with_only_one_of_the_two_files', async () => {
    const cache = memoryCache();
    await cache.put(FILES[0]!.url, new Response(modelBytes));
    expect(await isMasksPackageInstalled(cache, FILES)).toBe(false);
  });

  it('TestR4_a_wrong_hash_stores_nothing_and_fails', async () => {
    const cache = memoryCache();
    const tampered = async (url: string) => responseOf(url.includes('huggingface') ? new Uint8Array([1, 2, 3, 5]) : runtimeBytes, url);
    expect(await downloadMasksPackage({ cache, files: FILES, fetchFile: tampered as never }, {})).toEqual({ ok: false, reason: 'failed' });
    expect(cache.entries.size).toBe(0);
  });

  it('TestR4_a_wrong_size_stores_nothing_and_fails', async () => {
    const cache = memoryCache();
    const short = async (url: string) => responseOf(url.includes('huggingface') ? modelBytes.slice(0, 3) : runtimeBytes, url);
    expect(await downloadMasksPackage({ cache, files: FILES, fetchFile: short as never }, {})).toEqual({ ok: false, reason: 'failed' });
    expect(cache.entries.size).toBe(0);
  });

  it('TestR3_an_address_on_another_host_is_refused_before_any_request', async () => {
    const cache = memoryCache();
    const fetchFile = vi.fn();
    const files = [{ ...FILES[0]!, url: 'https://evil.example/model.onnx' }, FILES[1]!];
    expect(await downloadMasksPackage({ cache, files, fetchFile: fetchFile as never }, {})).toEqual({ ok: false, reason: 'failed' });
    expect(fetchFile).not.toHaveBeenCalled();
  });

  it('TestR3_a_redirect_to_another_host_is_discarded_unread', async () => {
    const cache = memoryCache();
    const redirected = async (url: string) => responseOf(url.includes('huggingface') ? modelBytes : runtimeBytes, url.includes('huggingface') ? 'https://evil.example/model.onnx' : url);
    expect(await downloadMasksPackage({ cache, files: FILES, fetchFile: redirected as never }, {})).toEqual({ ok: false, reason: 'failed' });
    expect(cache.entries.size).toBe(0);
  });

  it('TestR9_a_network_error_is_a_failure_and_stores_nothing', async () => {
    const cache = memoryCache();
    const offline = async () => {
      throw new TypeError('Failed to fetch');
    };
    expect(await downloadMasksPackage({ cache, files: FILES, fetchFile: offline as never }, {})).toEqual({ ok: false, reason: 'failed' });
    expect(cache.entries.size).toBe(0);
  });

  it('TestR9_cancelling_while_it_runs_is_aborted_and_leaves_the_package_not_installed', async () => {
    const cache = memoryCache();
    const controller = new AbortController();
    const fetchFile = async (url: string) => {
      controller.abort();
      return responseOf(modelBytes, url);
    };
    expect(await downloadMasksPackage({ cache, files: FILES, fetchFile: fetchFile as never }, { signal: controller.signal })).toEqual({ ok: false, reason: 'aborted' });
    expect(await isMasksPackageInstalled(cache, FILES)).toBe(false);
  });
});
