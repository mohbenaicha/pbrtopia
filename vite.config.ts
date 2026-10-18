import react from '@vitejs/plugin-react';
import { defineConfig } from 'vitest/config';

// Component tests opt into jsdom with a `// @vitest-environment jsdom` line; everything else runs in Node.
export default defineConfig({
  plugins: [react()],
  test: {
    include: ['tests/**/*.test.ts', 'tests/**/*.test.tsx'],
    exclude: ['tests/gpu/**', 'tests/ui/**', 'node_modules/**'],
    environment: 'node',
  },
});
