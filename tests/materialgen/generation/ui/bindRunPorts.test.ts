import { describe, expect, it, vi } from 'vitest';
import type { GenerateRequest, ImageGenerator } from '@shared/generation/providers/ImageGenerator';
import { encodePng, type PixelImage } from '@mat/maps';
import { bindRunPorts, MASKS_STEPS_UNAVAILABLE, REFERENCE_MAX_SIDE_PX } from '@mat/generation/ui/bindRunPorts';

const scaleSpy = vi.hoisted(() => vi.fn());
vi.mock('@shared/generation/imageScaling/scaleImageToMaxSide', () => ({ scaleImageToMaxSide: scaleSpy }));

const request = { prompt: 'brick', modelId: 'm', sizePx: 1024 } as unknown as GenerateRequest;
const pixels = (width: number, height: number): PixelImage => ({ width, height, channels: 3, data: new Uint8Array(width * height * 3).fill(90) });

function bind(key: string | null) {
  const generate = vi.fn(async () => ({ ok: true as const, value: { blob: new Blob(['x']), mimeType: 'image/png' } }));
  const adapter: ImageGenerator = { generate };
  const commitMaps = vi.fn(async () => true);
  const ports = bindRunPorts({ backends: { createImageGenerator: () => adapter, keys: { getKey: () => key } }, commitMaps, masks: MASKS_STEPS_UNAVAILABLE });
  return { ports, generate, commitMaps };
}

describe('materialgen/generation run ports', () => {
  it('R65 a provider without a stored key fails with the Settings > Keys line and calls nothing', async () => {
    const { ports, generate } = bind(null);
    const result = await ports.generateImage('openai', request, new AbortController().signal);
    expect(result).toMatchObject({ ok: false, error: { category: 'auth', message: 'Add your OpenAI key in Settings > Keys' } });
    expect(generate).not.toHaveBeenCalled();
  });

  it('R14 the key is read per call and handed to the adapter with the run signal', async () => {
    const { ports, generate } = bind('secret');
    const signal = new AbortController().signal;
    const result = await ports.generateImage('gemini', request, signal);
    expect(result.ok).toBe(true);
    expect(generate).toHaveBeenCalledWith(request, { apiKey: 'secret', signal });
  });

  it('R47 a returned PNG decodes to pixels and anything else decodes to null', async () => {
    const { ports } = bind('k');
    const decoded = await ports.decodeImage(new Blob([encodePng(pixels(8, 4)) as BlobPart], { type: 'image/png' }));
    expect(decoded).toMatchObject({ width: 8, height: 4 });
    expect(await ports.decodeImage(new Blob(['not an image']))).toBeNull();
  });

  it('R6 the albedo reference is a PNG scaled to the reference size, or the PNG itself when scaling fails', async () => {
    const { ports } = bind('k');
    const scaled = new Blob(['small'], { type: 'image/png' });
    scaleSpy.mockResolvedValueOnce({ ok: true, value: scaled });
    expect(await ports.makeAlbedoReference(pixels(16, 16))).toBe(scaled);
    expect(scaleSpy.mock.calls[0]![1]).toBe(REFERENCE_MAX_SIDE_PX);
    scaleSpy.mockResolvedValueOnce({ ok: false, error: 'no canvas' });
    const fallback = await ports.makeAlbedoReference(pixels(16, 16));
    expect(fallback.type).toBe('image/png');
    expect(fallback.size).toBeGreaterThan(0);
  });

  it('R58 until the masks steps are bound the decomposition steps fail with a plain line', async () => {
    const { ports } = bind('k');
    const signal = new AbortController().signal;
    expect(await ports.describeAlbedo(new Blob(), 'brick', signal)).toEqual({ ok: false, message: 'The Metal-Roughness image is not available in this build yet.' });
    expect(await ports.acceptDecomposition(new Blob(), pixels(2, 2), { components: [] }, signal)).toMatchObject({ ok: false });
  });

  it('R42 the cut tiles go to the maps controller unchanged', async () => {
    const { ports, commitMaps } = bind('k');
    const maps = [{ kind: 'albedo' as const, image: pixels(2, 2) }];
    expect(await ports.commitMaps(maps)).toBe(true);
    expect(commitMaps).toHaveBeenCalledWith(maps);
  });

  it('R42 a maps controller that throws is reported as not stored, never thrown into the run', async () => {
    const commitMaps = vi.fn(async () => { throw new Error('quota'); });
    const ports = bindRunPorts({ backends: { createImageGenerator: () => ({ generate: vi.fn() }), keys: { getKey: () => 'k' } }, commitMaps, masks: MASKS_STEPS_UNAVAILABLE });
    expect(await ports.commitMaps([{ kind: 'albedo' as const, image: pixels(2, 2) }])).toBe(false);
  });
});
