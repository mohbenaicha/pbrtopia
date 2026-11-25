import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// `@shared` is the projection app's source and `@mat` the material generator's. At the later repo split only
// these two targets change (see specs/shared/materialgen-prep R1-R3).
export const SOURCE_ALIASES = {
  '@shared': path.resolve(import.meta.dirname, 'src'),
  '@mat': path.resolve(import.meta.dirname, 'src/materialgen'),
};

/** Mirrors DEDUPED_PACKAGES of src/materialgen/entry/vite.config.ts; a test keeps the two equal (materialgen app R51). */
export const DEDUPED_PACKAGES = ['react', 'react-dom', 'three'];

// Component tests opt into jsdom with a `// @vitest-environment jsdom` line; everything else runs in Node.
export default defineConfig({
  plugins: [react()],
  // Only a worker imports it, on the first mask generation; Vite does not scan workers, so without this it optimises the package then and reloads the page mid-generation.
  optimizeDeps: { include: ['@huggingface/transformers'] },
  resolve: { alias: SOURCE_ALIASES, dedupe: DEDUPED_PACKAGES },
  assetsInclude: ['**/*.bin'], // the material ball's packed mesh is imported as an asset
  build: { outDir: 'builds/web/projection', emptyOutDir: true }, // app/builds R1
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/gpu/**', 'tests/ui/**', 'node_modules/**', 'upstream/tests/**'],
    environment: 'node',
    setupFiles: ['tests/support/testingLibrarySetup.ts'],
  },
});
