import { describe, expect, it } from 'vitest';
import viteConfig from '../../../../src/materialgen/entry/vite.config';
import { dropOrtWasm } from '../../../../src/materialgen/entry/dropOrtWasm';

describe('the build drops the onnx runtime wasm (masks-package R2)', () => {
  it('TestR2_the_runtime_wasm_that_onnxruntime_names_in_its_own_loader_is_removed_from_the_output', () => {
    const bundle: Record<string, unknown> = {
      'assets/ort-wasm-simd-threaded.jsep-B0T3yYHD.wasm': {},
      'assets/ort-wasm-simd-threaded-AbCdEf.wasm': {},
      'assets/xatlas-BoZ5JfyM.wasm': {},
      'assets/index-C2f_dfk7.js': {},
    };
    (dropOrtWasm().generateBundle as (options: unknown, bundle: Record<string, unknown>) => void)({}, bundle);
    expect(Object.keys(bundle)).toEqual(['assets/xatlas-BoZ5JfyM.wasm', 'assets/index-C2f_dfk7.js']);
  });

  it('TestR2_the_material_build_uses_the_plugin', () => {
    const plugins = (viteConfig as { plugins: Array<{ name?: string } | Array<{ name?: string }>> }).plugins.flat();
    expect(plugins.some((plugin) => plugin.name === 'drop-ort-wasm')).toBe(true);
  });
});
