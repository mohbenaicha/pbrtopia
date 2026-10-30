import { afterEach, describe, expect, it, vi } from 'vitest';
import { computeScaledSize, scaleImageToMaxSide } from '../../../src/generation/imageScaling/scaleImageToMaxSide';

afterEach(() => vi.unstubAllGlobals());

function stubBrowser(bitmap: { width: number; height: number } | null) {
  const drawn: { width: number; height: number }[] = [];
  const types: (string | undefined)[] = [];
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => { if (bitmap === null) throw new Error('cannot decode'); return { ...bitmap, close }; }));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(readonly width: number, readonly height: number) { drawn.push({ width, height }); }
      getContext() { return { drawImage: vi.fn() }; }
      async convertToBlob(options?: { type?: string }): Promise<Blob> { types.push(options?.type); return new Blob(['scaled'], { type: options?.type ?? '' }); }
    },
  );
  return { drawn, types, close };
}

describe('computeScaledSize', () => {
  it('R29 scales the longest side down to the cap and keeps the proportions', () => {
    expect(computeScaledSize(3000, 1500, 1024)).toEqual({ width: 1024, height: 512 });
    expect(computeScaledSize(1500, 3000, 1024)).toEqual({ width: 512, height: 1024 });
    expect(computeScaledSize(4096, 4096, 512)).toEqual({ width: 512, height: 512 });
  });

  it('R29 returns null when the image is at or under the cap, so it is never scaled up', () => {
    expect(computeScaledSize(800, 600, 1024)).toBeNull();
    expect(computeScaledSize(1024, 1024, 1024)).toBeNull();
  });

  it('R29 rounds the other side to the nearest px and never returns a side below 1', () => {
    expect(computeScaledSize(1000, 3000, 1024)).toEqual({ width: 341, height: 1024 });
    expect(computeScaledSize(10000, 2, 1024)).toEqual({ width: 1024, height: 1 });
  });
});

describe('scaleImageToMaxSide', () => {
  it('R29 returns the very same blob when the image already fits', async () => {
    stubBrowser({ width: 800, height: 600 });
    const image = new Blob(['small'], { type: 'image/png' });
    const result = await scaleImageToMaxSide(image, 1024);
    expect(result).toEqual({ ok: true, value: image });
    expect((result as { value: Blob }).value).toBe(image);
  });

  it('R29 draws a larger image at the scaled size and frees the bitmap', async () => {
    const browser = stubBrowser({ width: 3000, height: 1500 });
    const result = await scaleImageToMaxSide(new Blob(['big'], { type: 'image/png' }), 1024);
    expect(result.ok).toBe(true);
    expect(browser.drawn).toEqual([{ width: 1024, height: 512 }]);
    expect(browser.close).toHaveBeenCalled();
  });

  it('R29 keeps JPEG and WebP and turns any other type into PNG', async () => {
    const browser = stubBrowser({ width: 3000, height: 1500 });
    await scaleImageToMaxSide(new Blob(['a'], { type: 'image/jpeg' }), 1024);
    await scaleImageToMaxSide(new Blob(['b'], { type: 'image/webp' }), 1024);
    await scaleImageToMaxSide(new Blob(['c'], { type: 'image/gif' }), 1024);
    await scaleImageToMaxSide(new Blob(['d'], { type: 'image/png' }), 1024);
    expect(browser.types).toEqual(['image/jpeg', 'image/webp', 'image/png', 'image/png']);
  });

  it('R29 reports an image the browser cannot decode', async () => {
    stubBrowser(null);
    const result = await scaleImageToMaxSide(new Blob(['broken']), 1024);
    expect(result.ok).toBe(false);
  });
});
