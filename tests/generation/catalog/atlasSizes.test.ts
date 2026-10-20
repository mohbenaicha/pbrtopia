import { describe, expect, it } from 'vitest';
import { DEFAULT_ATLAS_KEY, listAtlasSizes } from '../../../src/generation/catalog/atlasSizes';

describe('atlasSizes (generate R16)', () => {
  it('R16 offers 1K, 2K and 4K as 1024, 2048 and 4096 pixels', () => {
    expect(listAtlasSizes(8192)).toEqual([{ key: '1K', sizePx: 1024 }, { key: '2K', sizePx: 2048 }, { key: '4K', sizePx: 4096 }]);
  });

  it('R16 drops the sizes the device cannot make, keeping the boundary size', () => {
    expect(listAtlasSizes(4095).map((option) => option.key)).toEqual(['1K', '2K']);
    expect(listAtlasSizes(2048).map((option) => option.key)).toEqual(['1K', '2K']);
    expect(listAtlasSizes(1023)).toEqual([]);
  });

  it('R16 the default is 2K', () => {
    expect(DEFAULT_ATLAS_KEY).toBe('2K');
  });
});
