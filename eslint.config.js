import tseslint from 'typescript-eslint';

// Import boundaries from specs/architecture.md. Only `index.ts` of each folder is public.
const message = (text) => ({ message: text });

const engineForbidden = [
  { group: ['react', 'react-dom', 'react/*', 'react-dom/*', 'zustand', 'zustand/*'], ...message('The engine is framework-free.') },
  { group: ['**/projects', '**/projects/**', '**/keys', '**/keys/**', '**/generation', '**/generation/**'], ...message('The engine knows nothing of storage, keys or providers.') },
  { group: ['**/viewport', '**/viewport/**', '**/app', '**/app/**', '**/ui-kit', '**/ui-kit/**', '**/projection/mode', '**/projection/mode/**'], ...message('The engine does not import UI or app code.') },
];

const generationForbidden = [
  { group: ['**/projection/**'], ...message('Generation takes atlas bytes from the caller and never imports the engine or mode.') },
  { group: ['**/projects', '**/projects/**', '**/viewport', '**/viewport/**', '**/app', '**/app/**'], ...message('Generation may import keys and ui-kit only.') },
];

const projectsForbidden = [
  { group: ['**/generation', '**/generation/**', '**/keys', '**/keys/**', '**/viewport', '**/viewport/**', '**/app', '**/app/**'], ...message('Projects holds record types and storage only.') },
];
// Projects may name the engine's record types (`import type`) but never import engine code.
const projectsEngineTypesOnly = [
  { group: ['**/projection/**'], allowTypeImports: true, ...message('Projects may import engine record types only (import type).') },
];

const keysForbidden = [
  { group: ['**/projection/**', '**/generation', '**/generation/**', '**/projects', '**/projects/**', '**/viewport', '**/viewport/**', '**/app', '**/app/**'], ...message('Keys depends on nothing but ui-kit.') },
];

const viewportForbidden = [
  { group: ['**/projection/**', '**/generation', '**/generation/**', '**/projects', '**/projects/**', '**/keys', '**/keys/**', '**/app', '**/app/**'], ...message('The viewport imports three and ui-kit only.') },
];

// Mode may use the engine's public entry only (not its internal folders).
const modeForbidden = [
  { group: ['**/engine/*/**', '**/projection/engine/*/**'], ...message('Import the engine through its index only.') },
  { group: ['**/projects', '**/projects/**', '**/keys', '**/keys/**', '**/generation', '**/generation/**', '**/app', '**/app/**'], ...message('Mode imports the engine, viewport and ui-kit only.') },
];

// Everything outside ui-kit reaches it through its index only (R21).
const uiKitInternals = { group: ['**/ui-kit/*'], ...message('Import the shared UI from ui-kit, not from a file inside it.') };

// ui-kit is the bottom layer: it imports no other src folder.
const uiKitForbidden = [
  { group: ['**/projection', '**/projection/**', '**/generation', '**/generation/**', '**/projects', '**/projects/**', '**/keys', '**/keys/**', '**/viewport', '**/viewport/**', '**/app', '**/app/**'], ...message('ui-kit imports nothing from other src folders.') },
];

const restrict = (files, patterns) => ({
  files,
  rules: { 'no-restricted-imports': ['error', { patterns: [...patterns, uiKitInternals] }] },
});

export default tseslint.config(
  { ignores: ['node_modules', 'dist', 'research', 'specs', 'ui-demo', 'icons'] },
  ...tseslint.configs.recommended,
  restrict(['src/projection/engine/**/*.ts'], engineForbidden),
  restrict(['src/generation/**/*.ts', 'src/generation/**/*.tsx'], generationForbidden),
  restrict(['src/projects/**/*.ts', 'src/projects/**/*.tsx'], projectsForbidden),
  {
    files: ['src/projects/**/*.ts', 'src/projects/**/*.tsx'],
    rules: { '@typescript-eslint/no-restricted-imports': ['error', { patterns: projectsEngineTypesOnly }] },
  },
  restrict(['src/keys/**/*.ts', 'src/keys/**/*.tsx'], keysForbidden),
  restrict(['src/app/**/*.ts', 'src/app/**/*.tsx'], []),
  {
    files: ['src/ui-kit/**/*.ts', 'src/ui-kit/**/*.tsx'],
    rules: { 'no-restricted-imports': ['error', { patterns: uiKitForbidden }] },
  },
  restrict(['src/viewport/**/*.ts', 'src/viewport/**/*.tsx'], viewportForbidden),
  restrict(['src/projection/mode/**/*.ts', 'src/projection/mode/**/*.tsx'], modeForbidden),
);
