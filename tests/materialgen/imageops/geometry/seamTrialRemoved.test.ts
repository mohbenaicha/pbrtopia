import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const root = resolve(__dirname, '../../../..');

describe('materialgen Blend edges replaces the debug trial', () => {
  it('R70 the seam trial folder and its Maps panel section are gone', () => {
    expect(existsSync(resolve(root, 'src/materialgen/seams'))).toBe(false);
    expect(readFileSync(resolve(root, 'src/materialgen/app/panels/MaterialMapsPanel.tsx'), 'utf8')).not.toMatch(/Seam trial|SeamTrial/);
    expect(readFileSync(resolve(root, 'src/materialgen/preview/ui/usePreviewMaps.ts'), 'utf8')).not.toMatch(/seams|Seam/);
  });
});
