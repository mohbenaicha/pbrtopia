import { describe, expect, it } from 'vitest';
import { StoreAbort } from '../../src/projects';
import { TILE_BYTES, TILE_HALF_FLOATS, bytesToThumbnail, decodeTile, encodeJsonRecord, encodeTile, parseTileKey, tileKey, thumbnailToBytes, decodeJsonOr } from '../../src/storage-desktop/recordCodecs';

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

describe('encodeJsonRecord / decodeJsonOr (storage-backends R5, R9)', () => {
  it('R5 a plain record round-trips as JSON text', () => {
    const record = { id: 'p1', name: 'Bricks', nested: { list: [1, 2.5, 'x', null, true] } };
    const bytes = encodeJsonRecord(record);
    expect(JSON.parse(text(bytes))).toEqual(record);
    expect(decodeJsonOr(bytes, () => ({}))).toEqual(record);
  });

  it('R5 a record holding bytes or a Blob, or a number JSON cannot hold, is refused as "corrupt" instead of being saved wrongly', () => {
    for (const bad of [{ a: new Uint8Array(2) }, { a: new Uint16Array(2) }, { a: new ArrayBuffer(2) }, { a: new Blob(['x']) }, { a: NaN }, { a: { b: [Infinity] } }]) {
      expect(() => encodeJsonRecord(bad)).toThrow(StoreAbort);
      try {
        encodeJsonRecord(bad);
      } catch (error) {
        expect((error as StoreAbort).storeError.code).toBe('corrupt');
      }
    }
  });

  it('R9 bytes that are not valid JSON give the fallback, so a damaged record is listed as an unreadable one', () => {
    expect(decodeJsonOr(new TextEncoder().encode('{"id": "p1", '), () => ({ id: 'fallback' }))).toEqual({ id: 'fallback' });
    expect(decodeJsonOr(new Uint8Array([0xff, 0xfe, 0x00]), () => 'fb')).toBe('fb');
  });
});

describe('tiles (storage-backends R5)', () => {
  it('R5 a tile is 8192 bytes, little endian, and comes back as the same half floats', () => {
    const half = Uint16Array.from({ length: TILE_HALF_FLOATS }, (_, i) => (i * 7 + 1) % 65536);
    half[0] = 0x3c00;
    const bytes = encodeTile(half);
    expect(bytes.length).toBe(TILE_BYTES);
    expect([bytes[0], bytes[1]]).toEqual([0x00, 0x3c]); // low byte first
    expect(decodeTile(bytes)).toEqual(half);
  });

  it('R5 a tile of the wrong size is refused on the way in and on the way out', () => {
    expect(() => encodeTile(new Uint16Array(10))).toThrow(StoreAbort);
    expect(() => decodeTile(new Uint8Array(100))).toThrow(StoreAbort);
  });

  it('R5 the tile key is "setId/layer/tx/ty" and reads back, whatever the set id holds', () => {
    expect(tileKey(['s1', 2, 3, 4])).toBe('s1/2/3/4');
    expect(parseTileKey('s1/2/3/4')).toEqual(['s1', 2, 3, 4]);
    expect(parseTileKey(tileKey(['we/ird', 10, 0, 99]))).toEqual(['we/ird', 10, 0, 99]);
  });
});

describe('thumbnails (storage-backends R5)', () => {
  it('R5 a thumbnail goes to bytes and comes back as an image/jpeg Blob with the same bytes', async () => {
    const bytes = await thumbnailToBytes(new Blob([Uint8Array.from([1, 2, 3])], { type: 'image/jpeg' }));
    expect([...bytes]).toEqual([1, 2, 3]);
    const blob = bytesToThumbnail(bytes);
    expect(blob.type).toBe('image/jpeg');
    expect([...new Uint8Array(await blob.arrayBuffer())]).toEqual([1, 2, 3]);
  });
});
