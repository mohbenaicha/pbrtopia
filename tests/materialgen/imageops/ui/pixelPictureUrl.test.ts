// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { pixelsToPictureUrl } from '@mat/imageops/ui/pixelPictureUrl';

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('pixelsToPictureUrl', () => {
  it('R87 the picture is encoded at once with toDataURL, never with the idle-bound toBlob', async () => {
    const toBlob = vi.fn();
    const toDataURL = vi.fn(() => 'data:image/png;base64,AAAA');
    const canvas = { width: 0, height: 0, getContext: () => ({ putImageData: vi.fn() }), toBlob, toDataURL };
    vi.spyOn(document, 'createElement').mockReturnValue(canvas as unknown as HTMLCanvasElement);
    vi.stubGlobal('ImageData', class { constructor(public data: Uint8ClampedArray, public width: number, public height: number) {} });

    const url = await pixelsToPictureUrl({ width: 1, height: 1, channels: 1, data: new Uint8Array([7]) });

    expect(url).toBe('data:image/png;base64,AAAA');
    expect(toDataURL).toHaveBeenCalledWith('image/png');
    expect(toBlob).not.toHaveBeenCalled();
  });
});
