import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import viteConfig from '../../../../src/materialgen/entry/vite.config';
import { MASKS_PACKAGE_BYTES, MASKS_PACKAGE_FILES, isTrustedAddress } from '../../../../src/materialgen/masks/package/masksPackageManifest';

describe('the masks package manifest (masks-package R1, R2, R3, R13)', () => {
  it('TestR1_the_package_is_the_model_and_the_runtime_with_their_sizes_and_hashes', () => {
    expect(MASKS_PACKAGE_FILES.map((file) => [file.id, file.bytes, file.sha256])).toEqual([
      ['model', 22972370, 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1'],
      ['runtime', 21596019, 'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39'],
    ]);
    expect(MASKS_PACKAGE_FILES.map((file) => file.url)).toEqual([
      'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
      'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/ort-wasm-simd-threaded.jsep.wasm',
    ]);
    expect(MASKS_PACKAGE_BYTES).toBe(44568389);
  });

  it('TestR2_the_build_has_no_alias_or_glob_that_picks_the_files_from_the_disk', () => {
    const alias = (viteConfig as { resolve: { alias: Record<string, string> } }).resolve.alias;
    expect(Object.keys(alias)).not.toContain('@ort');
    const source = readFileSync('src/materialgen/masks/embed/runMiniLmEmbedding.ts', 'utf8');
    expect(source).not.toMatch(/@ort|model_quantized|minilm\/\*\*/);
  });

  it('TestR3_only_https_addresses_on_the_trusted_hosts_are_trusted', () => {
    expect(isTrustedAddress('https://huggingface.co/Xenova/x.onnx')).toBe(true);
    expect(isTrustedAddress('https://us.aws.cdn.hf.co/xet-bridge-us/abc')).toBe(true);
    expect(isTrustedAddress('https://cdn.jsdelivr.net/npm/a/b.wasm')).toBe(true);
    expect(isTrustedAddress('https://evil.example/huggingface.co')).toBe(false);
    expect(isTrustedAddress('https://nothf.co/x')).toBe(false);
    expect(isTrustedAddress('https://huggingface.co.evil.example/x')).toBe(false);
    expect(isTrustedAddress('http://huggingface.co/x')).toBe(false);
    expect(isTrustedAddress('not an address')).toBe(false);
  });

  it('TestR13_the_exe_may_connect_to_exactly_the_trusted_hosts_besides_its_two_model_apis', () => {
    const csp = (JSON.parse(readFileSync('src-tauri/tauri.conf.json', 'utf8')) as { app: { security: { csp: string } } }).app.security.csp;
    const connect = csp.split(';').map((part) => part.trim()).find((part) => part.startsWith('connect-src')) ?? '';
    const hosts = connect.split(/\s+/).filter((token) => token.startsWith('https://')).sort();
    expect(hosts).toEqual(['https://*.hf.co', 'https://api.openai.com', 'https://cdn.jsdelivr.net', 'https://generativelanguage.googleapis.com', 'https://huggingface.co']);
  });
});
