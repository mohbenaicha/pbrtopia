import path from 'node:path';
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

// The material app's own build (materialgen app R2, R3, R5, R51). After the repo split only `sharedRoot` changes.
const entryDir = import.meta.dirname;
const materialRoot = path.resolve(entryDir, '..'); // @mat
const sharedRoot = path.resolve(entryDir, '../..'); // @shared (the projection app's src)
const repoRoot = path.resolve(sharedRoot, '..');

/** One copy of each of these, from the single root node_modules (a second copy would split React's or three's state). */
export const DEDUPED_PACKAGES = ['react', 'react-dom', 'three'];

export default defineConfig({
  root: entryDir,
  envDir: repoRoot,
  publicDir: path.resolve(sharedRoot, '../public'), // the HDRI files, resolved from the shared root
  plugins: [react()],
  assetsInclude: ['**/*.bin'], // the material ball's packed mesh is imported as an asset
  // `@ort` is the onnx runtime's runtime files, which the MiniLM worker serves from the app itself (masks R73)
  resolve: { alias: { '@shared': sharedRoot, '@mat': materialRoot, '@ort': path.resolve(repoRoot, 'node_modules/onnxruntime-web/dist') }, dedupe: DEDUPED_PACKAGES },
  build: { outDir: path.resolve(repoRoot, 'builds/web/material'), emptyOutDir: true },
});
