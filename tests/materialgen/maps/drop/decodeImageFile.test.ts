import { describe, expect, it, vi } from 'vitest';
import { decodeImageFile } from '../../../../src/materialgen/maps/drop/decodeImageFile';
import { PNG_SIGNATURE, writeChunk } from '../../../../src/materialgen/maps/png/pngChunks';

/** A PNG whose header claims a size but whose pixel data is a few bytes: reading it fully would allocate gigabytes. */
function pngClaiming(width: number, height: number): File {
  const head = new Uint8Array(13);
  const view = new DataView(head.buffer);
  view.setUint32(0, width);
  view.setUint32(4, height);
  head[8] = 8; // bit depth
  head[9] = 2; // RGB
  const parts = [PNG_SIGNATURE, writeChunk('IHDR', head), writeChunk('IDAT', Uint8Array.of(120, 156, 3, 0, 0, 0, 0, 1)), writeChunk('IEND', new Uint8Array())];
  return new File(parts as BlobPart[], 'huge.png', { type: 'image/png' });
}

describe('materialgen/maps R38 R40 decoding a dropped file', () => {
  it('R38 a PNG whose header names a side over 8192 is refused as "Image too large" before its pixels are read, and the browser decoder is not tried', async () => {
    const browser = vi.fn();
    const outcome = await decodeImageFile(pngClaiming(30000, 30000), browser);
    expect(outcome).toEqual({ ok: false, message: 'Image too large' });
    expect(browser).not.toHaveBeenCalled();
  });

  it('R38 the limit is on the longer side: 8192 passes the header check (and then fails as damaged data, not as too large)', async () => {
    const outcome = await decodeImageFile(pngClaiming(8192, 1), vi.fn(async () => ({ width: 1, height: 1, channels: 4 as const, data: new Uint8Array(4) })));
    expect(outcome.ok || outcome.message !== 'Image too large').toBe(true);
  });
});
