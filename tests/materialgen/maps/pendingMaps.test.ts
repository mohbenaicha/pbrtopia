import { describe, expect, it } from 'vitest';
import { withPendingMaps } from '../../../src/materialgen/maps/pendingMaps';
import type { MapRecord, MapsState } from '../../../src/materialgen/maps';
import type { PixelImage } from '../../../src/materialgen/maps/png/pngCodec';

const image: PixelImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(48) };
const record = (key: string): MapRecord => ({ originalKey: `o-${key}`, workingKey: key, undoKey: null, width: 8, height: 8 });
const state: MapsState = { size: 1024, maps: { albedo: record('a'), rough: record('r') } };

describe('materialgen/maps R71 withPendingMaps', () => {
  it('R71 with nothing pending the very same state comes back', () => {
    expect(withPendingMaps(state, {})).toBe(state);
  });

  it('R71 a pending picture replaces the working key of an existing map and touches nothing else', () => {
    const shown = withPendingMaps(state, { albedo: { workingKey: 'new', image } });
    expect(shown.maps.albedo).toEqual({ ...record('a'), workingKey: 'new' });
    expect(shown.maps.rough).toBe(state.maps.rough);
    expect(shown.size).toBe(1024);
  });

  it('R71 a pending picture for an empty slot gives that map a record of its own, so the preview can show it', () => {
    const shown = withPendingMaps(state, { normal: { workingKey: 'n1', image } });
    expect(shown.maps.normal).toMatchObject({ originalKey: 'n1', workingKey: 'n1', undoKey: null });
    expect(shown.maps.albedo).toBe(state.maps.albedo);
  });
});
