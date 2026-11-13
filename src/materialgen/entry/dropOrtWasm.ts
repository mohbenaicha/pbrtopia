import type { Plugin } from 'vite';

/**
 * Masks-package R2: onnxruntime names its wasm in its own loader (`new URL(..., import.meta.url)`), which makes Vite copy the 21.6 MB file into the
 * output. The app never uses that copy (the runtime comes from the downloaded package), so it is taken out of the output.
 */
export function dropOrtWasm(): Plugin {
  return {
    name: 'drop-ort-wasm',
    generateBundle(_options, bundle) {
      for (const fileName of Object.keys(bundle)) {
        if (/(^|\/)ort-wasm[^/]*\.wasm$/.test(fileName)) delete bundle[fileName];
      }
    },
  };
}
