import { afterEach, describe, expect, it, vi } from 'vitest';
import { computePreviewSize, makeImagePreview } from '../../src/generation/makeImagePreview';

afterEach(() => vi.unstubAllGlobals());

const source = new Blob(['full size image']);

function stubBrowser(bitmap: { width: number; height: number }, drawn: { width: number; height: number }[]) {
  const close = vi.fn();
  vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ ...bitmap, close })));
  vi.stubGlobal(
    'OffscreenCanvas',
    class {
      constructor(
        readonly width: number,
        readonly height: number,
      ) {
        drawn.push({ width, height });
      }
      getContext() {
        return { drawImage: vi.fn() };
      }
      async convertToBlob(): Promise<Blob> {
        return new Blob(['preview'], { type: 'image/jpeg' });
      }
    },
  );
  return close;
}

describe('computePreviewSize', () => {
  it('R24 scales the longer side down to the limit and keeps the proportions', () => {
    expect(computePreviewSize(4096, 4096, 1024)).toEqual({ width: 1024, height: 1024 });
    expect(computePreviewSize(2048, 1024, 1024)).toEqual({ width: 1024, height: 512 });
    expect(computePreviewSize(1000, 3000, 1024)).toEqual({ width: 341, height: 1024 });
  });

  it('R24 never scales an image up, and never returns a side below 1', () => {
    expect(computePreviewSize(800, 600, 1024)).toEqual({ width: 800, height: 600 });
    expect(computePreviewSize(10000, 2, 1024)).toEqual({ width: 1024, height: 1 });
  });
});

describe('makeImagePreview', () => {
  it('R24 makes a smaller picture of an image larger than 1024 px, and releases the decoded image', async () => {
    const drawn: { width: number; height: number }[] = [];
    const close = stubBrowser({ width: 2048, height: 2048 }, drawn);
    const preview = await makeImagePreview(source);
    expect(drawn).toEqual([{ width: 1024, height: 1024 }]);
    expect(preview).not.toBe(source);
    expect(preview.type).toBe('image/jpeg');
    expect(close).toHaveBeenCalledOnce();
  });

  it('R24 returns the image itself when it already fits', async () => {
    const drawn: { width: number; height: number }[] = [];
    stubBrowser({ width: 1024, height: 700 }, drawn);
    expect(await makeImagePreview(source)).toBe(source);
    expect(drawn).toEqual([]);
  });

  it('R24 gives no preview when the browser cannot decode the picture, since its size cannot be limited', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => Promise.reject(new Error('bad image'))));
    await expect(makeImagePreview(source)).rejects.toThrow('bad image');
  });
});
