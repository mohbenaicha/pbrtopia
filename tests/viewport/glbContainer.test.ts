import { describe, expect, it } from 'vitest';
import { readGlb, writeGlb } from '../../src/viewport/glbContainer';
import { buildGlbFromJsonText, buildTriangleGlb } from './glbBuilder';

describe('readGlb and writeGlb (mesh edit R25)', () => {
  it('mesh edit R25 reads the JSON and the binary chunk of a GLB', () => {
    const parts = readGlb(buildTriangleGlb());
    expect(parts).not.toBeNull();
    expect(parts!.json['asset']).toEqual({ version: '2.0' });
    expect(parts!.bin!.length).toBe(36);
  });

  it('mesh edit R25 a GLB written from what was read is read back the same, with both chunks padded to 4 bytes', () => {
    const original = readGlb(buildTriangleGlb())!;
    const written = writeGlb(original.json, original.bin);
    expect(written.byteLength % 4).toBe(0);
    expect(new DataView(written).getUint32(8, true)).toBe(written.byteLength);
    const again = readGlb(written)!;
    expect(again.json).toEqual(original.json);
    expect(Array.from(again.bin!)).toEqual(Array.from(original.bin!));
  });

  it('mesh edit R25 a GLB without a binary chunk reads with bin null and is written without one', () => {
    const parts = readGlb(buildGlbFromJsonText('{"asset":{"version":"2.0"}}'))!;
    expect(parts.bin).toBeNull();
    expect(readGlb(writeGlb(parts.json, null))!.bin).toBeNull();
  });

  it('mesh edit R25 pads a binary chunk that is not a multiple of 4 with zeros', () => {
    const written = writeGlb({ asset: { version: '2.0' } }, Uint8Array.from([1, 2, 3, 4, 5]));
    expect(Array.from(readGlb(written)!.bin!)).toEqual([1, 2, 3, 4, 5, 0, 0, 0]);
  });

  it('mesh edit R25 returns null for bytes that are not a GLB, a cut file and a chunk that runs past the end', () => {
    expect(readGlb(new ArrayBuffer(8))).toBeNull();
    expect(readGlb(new TextEncoder().encode('not a glb at all, just some text').buffer as ArrayBuffer)).toBeNull();
    const good = buildTriangleGlb();
    expect(readGlb(good.slice(0, good.byteLength - 10))).toBeNull();
  });
});
