import { describe, expect, it } from 'vitest';
import { readGlb, writeGlb } from '../../src/viewport/glbContainer';
import { readSourceImages, replaceImages } from '../../src/viewport/sourceImages';
import { buildGlbFromJsonText, buildTexturedQuadGlb, buildTriangleGlb } from './glbBuilder';

const PNG_HEAD = [0x89, 0x50, 0x4e, 0x47];
const bytesOf = (length: number, seed: number): Uint8Array => Uint8Array.from({ length }, (_, i) => (seed + i * 7) & 0xff);
const withPngHead = (body: Uint8Array): Uint8Array => Uint8Array.from([...PNG_HEAD, ...body]);

describe('readSourceImages (mesh edit R25)', () => {
  it('mesh edit R25 returns the bytes and type of each image stored in the binary chunk, by image index', () => {
    const colour = withPngHead(bytesOf(11, 1));
    const data = withPngHead(bytesOf(30, 2));
    const images = readSourceImages(buildTexturedQuadGlb(colour, data));
    expect([...images.keys()]).toEqual([0, 1]);
    expect(images.get(0)).toMatchObject({ mimeType: 'image/png' });
    expect(Array.from(images.get(0)!.bytes)).toEqual(Array.from(colour));
    expect(Array.from(images.get(1)!.bytes)).toEqual(Array.from(data));
  });

  it('mesh edit R25 reads a base64 data URI image and skips an external file and a type that is not PNG or JPEG', () => {
    const png = withPngHead(bytesOf(5, 9));
    const json = {
      asset: { version: '2.0' },
      images: [
        { uri: `data:image/png;base64,${btoa(String.fromCharCode(...png))}` },
        { uri: 'external.png' },
        { uri: `data:image/webp;base64,${btoa('abc')}` },
        { bufferView: 0, mimeType: 'image/webp' },
        { uri: `data:image/jpeg;base64,${btoa('jpegbytes')}` },
      ],
      bufferViews: [{ buffer: 0, byteLength: 4 }],
      buffers: [{ byteLength: 4 }],
    };
    const images = readSourceImages(buildGlbFromJsonText(JSON.stringify(json), new Uint8Array(4)));
    expect([...images.keys()]).toEqual([0, 4]);
    expect(Array.from(images.get(0)!.bytes)).toEqual(Array.from(png));
    expect(images.get(4)!.mimeType).toBe('image/jpeg');
  });

  it('mesh edit R25 a file with no images, and bytes that are not a GLB, give an empty list', () => {
    expect(readSourceImages(buildTriangleGlb()).size).toBe(0);
    expect(readSourceImages(new ArrayBuffer(4)).size).toBe(0);
  });
});

describe('replaceImages (mesh edit R25)', () => {
  const placeholder = withPngHead(Uint8Array.from([0]));
  // A file shaped like an export whose pictures are placeholders: the quad with two images.
  const exportedLike = (): ArrayBuffer => buildTexturedQuadGlb(placeholder, placeholder);

  it('mesh edit R25 puts the given bytes and type into the image and leaves the geometry and the other pictures as they were', () => {
    const original = bytesOf(1000, 3);
    const patched = replaceImages(exportedLike(), new Map([[0, { mimeType: 'image/jpeg', bytes: original }]]));
    expect(patched).not.toBeNull();
    const parts = readGlb(patched!)!;
    const json = parts.json as { images: { bufferView: number; mimeType: string }[]; bufferViews: { byteOffset: number; byteLength: number }[]; buffers: { byteLength: number }[]; accessors: unknown[] };
    const view = (index: number): Uint8Array => parts.bin!.subarray(json.bufferViews[index]!.byteOffset, json.bufferViews[index]!.byteOffset + json.bufferViews[index]!.byteLength);
    expect(json.images[0]!.mimeType).toBe('image/jpeg');
    expect(Array.from(view(json.images[0]!.bufferView))).toEqual(Array.from(original));
    expect(Array.from(view(json.images[1]!.bufferView))).toEqual(Array.from(placeholder)); // untouched
    expect(Array.from(new Float32Array(view(0).slice().buffer))).toEqual([0, 0, 0, 1, 0, 0, 1, 1, 0, 0, 1, 0]); // the positions
    expect(Array.from(new Uint16Array(view(2).slice().buffer))).toEqual([0, 1, 2, 0, 2, 3]); // the indices
  });

  it('mesh edit R25 every buffer view starts on a multiple of 4, none overlaps another and the buffer length is the binary chunk', () => {
    const patched = replaceImages(exportedLike(), new Map([[0, { mimeType: 'image/png', bytes: bytesOf(1001, 1) }], [1, { mimeType: 'image/png', bytes: bytesOf(7, 2) }]]))!;
    const parts = readGlb(patched)!;
    const json = parts.json as { bufferViews: { byteOffset: number; byteLength: number }[]; buffers: { byteLength: number }[] };
    const ranges = json.bufferViews.map((v) => [v.byteOffset, v.byteOffset + v.byteLength] as const).sort((a, b) => a[0] - b[0]);
    for (const [start] of ranges) expect(start % 4).toBe(0);
    for (let i = 1; i < ranges.length; i += 1) expect(ranges[i]![0]).toBeGreaterThanOrEqual(ranges[i - 1]![1]);
    expect(json.buffers[0]!.byteLength).toBe(parts.bin!.length);
    expect(ranges[ranges.length - 1]![1]).toBeLessThanOrEqual(parts.bin!.length);
  });

  it('mesh edit R25 returns null, so the caller falls back, when the file has no binary chunk, a view in another buffer, or an image without a buffer view', () => {
    expect(replaceImages(buildGlbFromJsonText('{"asset":{"version":"2.0"},"images":[{"bufferView":0}],"bufferViews":[{"buffer":0,"byteLength":4}]}'), new Map([[0, { mimeType: 'image/png', bytes: bytesOf(4, 1) }]]))).toBeNull();
    const parts = readGlb(exportedLike())!;
    (parts.json['bufferViews'] as { buffer: number }[])[1]!.buffer = 1;
    expect(replaceImages(writeGlb(parts.json, parts.bin), new Map([[0, { mimeType: 'image/png', bytes: bytesOf(4, 1) }]]))).toBeNull();
    const noView = readGlb(exportedLike())!;
    (noView.json['images'] as { bufferView?: number; uri?: string }[])[0] = { uri: 'x.png' };
    expect(replaceImages(writeGlb(noView.json, noView.bin), new Map([[0, { mimeType: 'image/png', bytes: bytesOf(4, 1) }]]))).toBeNull();
  });

  it('mesh edit R25 an image index the file does not have returns null', () => {
    expect(replaceImages(exportedLike(), new Map([[5, { mimeType: 'image/png', bytes: bytesOf(4, 1) }]]))).toBeNull();
  });
});
