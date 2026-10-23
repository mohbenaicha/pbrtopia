import { afterEach, describe, expect, it, vi } from 'vitest';
import { readImageFile } from '../../../src/generation/ui/readImageFile';

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('readImageFile', () => {
  it('generate R2 describes a picked file as a reference image with its size, name and bytes, and frees the decoded bitmap', async () => {
    const close = vi.fn();
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 640, height: 480, close })));
    const file = new File(['png'], 'ref.png', { type: 'image/png', lastModified: 1234 });
    const image = await readImageFile(file);
    expect(image).toEqual({ id: 'ref.png:3:1234', name: 'ref.png', width: 640, height: 480, blob: file });
    expect(image.blob).toBe(file);
    expect(close).toHaveBeenCalledTimes(1);
  });

  it('generate R2 gives two different files different ids, so each can be added and removed on its own', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => ({ width: 1, height: 1, close: vi.fn() })));
    const first = await readImageFile(new File(['a'], 'ref.png', { lastModified: 1 }));
    const second = await readImageFile(new File(['ab'], 'ref.png', { lastModified: 1 }));
    const third = await readImageFile(new File(['a'], 'ref.png', { lastModified: 2 }));
    expect(new Set([first.id, second.id, third.id]).size).toBe(3);
  });

  it('generate R2 refuses a file the browser cannot decode as an image', async () => {
    vi.stubGlobal('createImageBitmap', vi.fn(async () => { throw new DOMException('not an image', 'InvalidStateError'); }));
    await expect(readImageFile(new File(['text'], 'notes.txt', { type: 'text/plain' }))).rejects.toThrow('not an image');
  });
});
