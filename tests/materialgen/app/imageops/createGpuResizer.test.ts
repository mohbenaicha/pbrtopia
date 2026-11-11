import { describe, expect, it, vi } from 'vitest';
import { createGpuResizer } from '@mat/app/imageops/createGpuResizer';
import type { PixelImage } from '@mat/imageops';

const image: PixelImage = { width: 8, height: 6, channels: 3, data: new Uint8Array(8 * 6 * 3) };

describe('materialgen/app R27 createGpuResizer', () => {
  it('R27 resamples the whole picture to S x S through the scale op, as the kind it is', async () => {
    const out: PixelImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(48) };
    const crop = vi.fn(async () => out);
    const resize = createGpuResizer({ crop });
    await expect(resize(image, 'normal', 4)).resolves.toBe(out);
    expect(crop).toHaveBeenCalledWith(image, 'normal', { x: 0, y: 0, width: 8, height: 6 }, 4);
  });

  it('R27 a Diffuse map is resampled as the albedo it is stored as', async () => {
    const crop = vi.fn(async () => image);
    await createGpuResizer({ crop })(image, 'diffuse', 4);
    expect(crop).toHaveBeenCalledWith(image, 'albedo', expect.anything(), 4);
  });

  it('R27 the decomposition (labels) is never resampled by the graphics card', async () => {
    const crop = vi.fn(async () => image);
    await expect(createGpuResizer({ crop })(image, 'labels', 4)).rejects.toThrow();
    expect(crop).not.toHaveBeenCalled();
  });
});
