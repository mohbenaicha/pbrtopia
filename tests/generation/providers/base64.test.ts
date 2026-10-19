import { describe, expect, it } from 'vitest';
import { decodeBase64ToBlob, encodeBlobBase64 } from '../../../src/generation/providers/base64';

const bytesOf = async (blob: Blob): Promise<number[]> => Array.from(new Uint8Array(await blob.arrayBuffer()));

describe('base64: Blob to text and back (R7, R8)', () => {
  it('R7 encodes the bytes of a blob as base64', async () => {
    expect(await encodeBlobBase64(new Blob([new Uint8Array([72, 105])]))).toBe('SGk=');
  });

  it('R7 an empty blob encodes to an empty string', async () => {
    expect(await encodeBlobBase64(new Blob([]))).toBe('');
  });

  it('R7 every byte value survives a round trip, with the type kept', async () => {
    const all = Uint8Array.from({ length: 256 }, (_, i) => i);
    const back = decodeBase64ToBlob(await encodeBlobBase64(new Blob([all])), 'image/jpeg');
    expect(back.type).toBe('image/jpeg');
    expect(await bytesOf(back)).toEqual(Array.from(all));
  });

  it('R7 a blob larger than one internal chunk round-trips', async () => {
    const big = new Uint8Array(200_000).map((_, i) => i % 251);
    const back = decodeBase64ToBlob(await encodeBlobBase64(new Blob([big])), 'image/png');
    expect(back.size).toBe(200_000);
    expect(await bytesOf(back.slice(199_990))).toEqual(Array.from(big.slice(199_990)));
  });
});
