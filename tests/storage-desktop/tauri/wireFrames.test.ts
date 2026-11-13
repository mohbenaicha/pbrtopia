import { describe, expect, it } from 'vitest';
import { decodeEntries, decodeOptionalBytes, encodeCommitBody } from '../../../src/storage-desktop/tauri/wireFrames';

const text = (bytes: Uint8Array): string => new TextDecoder().decode(bytes);

/** Bytes laid out by hand from the data-model: [u32 LE header length][JSON header][payloads]. */
function frame(header: unknown, ...payloads: number[][]): Uint8Array {
  const head = new TextEncoder().encode(JSON.stringify(header));
  const body = payloads.flat();
  const out = new Uint8Array(4 + head.length + body.length);
  new DataView(out.buffer).setUint32(0, head.length, true);
  out.set(head, 4);
  out.set(body, 4 + head.length);
  return out;
}

describe('wire frames (storage-backends data-model, commit wire format)', () => {
  it('R8 a commit body is a 4-byte little-endian header length, the JSON header, then the payloads in order', () => {
    const body = encodeCommitBody([
      { op: 'put', collection: 'sets', key: 's1', parent: 'p1', value: Uint8Array.of(1, 2, 3) },
      { op: 'put', collection: 'projects', key: 'p1', sort: '2026-01-02', value: Uint8Array.of(9) },
      { op: 'remove', collection: 'projects', key: 'old' },
      { op: 'removeByParent', collection: 'sets', parent: 'gone' },
    ]);
    const headerLength = new DataView(body.buffer, body.byteOffset).getUint32(0, true);
    expect(JSON.parse(text(body.subarray(4, 4 + headerLength)))).toEqual([
      { op: 'put', collection: 'sets', key: 's1', parent: 'p1', length: 3 },
      { op: 'put', collection: 'projects', key: 'p1', sort: '2026-01-02', length: 1 },
      { op: 'remove', collection: 'projects', key: 'old' },
      { op: 'removeByParent', collection: 'sets', parent: 'gone' },
    ]);
    expect([...body.subarray(4 + headerLength)]).toEqual([1, 2, 3, 9]);
  });

  it('R8 an empty value is a put of length 0, and no ops make a header of []', () => {
    const empty = encodeCommitBody([{ op: 'put', collection: 'settings', key: 'app', value: new Uint8Array(0) }]);
    expect(text(empty.subarray(4))).toBe('[{"op":"put","collection":"settings","key":"app","length":0}]');
    expect(text(encodeCommitBody([]).subarray(4))).toBe('[]');
  });

  it('R8 a listing decodes into entries with their keys, indexed keys and bytes, in order', () => {
    const entries = decodeEntries(frame([{ key: 'b', parent: 'p', length: 2 }, { key: 'a', sort: 's', length: 0 }, { key: 'c', length: 1 }], [7, 8], [], [5]).buffer as ArrayBuffer);
    expect(entries.map((entry) => ({ key: entry.key, parent: entry.parent, sort: entry.sort, value: [...entry.value] }))).toEqual([
      { key: 'b', parent: 'p', sort: undefined, value: [7, 8] },
      { key: 'a', parent: undefined, sort: 's', value: [] },
      { key: 'c', parent: undefined, sort: undefined, value: [5] },
    ]);
  });

  it('R8 an empty listing decodes to no entries', () => {
    expect(decodeEntries(frame([]).buffer as ArrayBuffer)).toEqual([]);
  });

  it('R9 a listing that is cut short or has the wrong sizes is refused instead of read past its end', () => {
    expect(() => decodeEntries(new Uint8Array([1, 2]).buffer)).toThrow();
    expect(() => decodeEntries(frame([{ key: 'a', length: 9 }], [1]).buffer as ArrayBuffer)).toThrow();
    expect(() => decodeEntries(frame([{ key: 'a', length: 1 }], [1, 2]).buffer as ArrayBuffer)).toThrow();
  });

  it('R8 a one-record answer is [0] for none and [1, ...bytes] for one; an empty value is told apart from none', () => {
    expect(decodeOptionalBytes(Uint8Array.of(0).buffer)).toBeNull();
    expect([...(decodeOptionalBytes(Uint8Array.of(1, 4, 5).buffer) ?? [])]).toEqual([4, 5]);
    expect(decodeOptionalBytes(Uint8Array.of(1).buffer)).toEqual(new Uint8Array(0));
  });

  it('R8 answers arrive as an ArrayBuffer, a typed array or a plain number list, and all read the same', () => {
    expect(decodeOptionalBytes(Uint8Array.of(1, 4))).toEqual(Uint8Array.of(4));
    expect(decodeOptionalBytes([1, 4])).toEqual(Uint8Array.of(4));
  });
});
