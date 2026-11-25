import { MAX_FEATHER, bakeNamedMasks, type BakeRow } from '../bake/bakeMasks';
import { meanGreyPerRow } from '../bake/colourMixin';
import { computeDirtyRegion, REGION_TILE, type DirtyRegion } from '../bake/computeDirtyRegion';
import type { MapName } from '../bake/diffBakedRows';
import { computeNearestIslandTexels, fillGutterFromTable, gutterReach } from '../bake/nearestIslandTexels';
import type { PixelImage } from '../imageTypes';

export interface SessionStart {
  size: number;
  labels: Uint8Array;
  maps: { rough: Uint8Array; metal: Uint8Array };
  coverage?: Uint8Array;
  grey?: Uint8Array;
}

export interface SessionEdit {
  rows: BakeRow[];
  feather: number;
  maps: MapName[]; // the maps this edit changes (R4); never empty
  changedLabels: number[] | 'all';
}

export interface LastEdit {
  path: 'full' | 'region';
  share: number; // the fraction of the picture's tiles recomputed (1 on a full bake)
}

const NAMES: readonly MapName[] = ['rough', 'metal'];

/**
 * Mask-bake-session R5, R7, R9: the worker-side state of one open masks record. It owns copies of the labels, the two current maps, the island coverage (with the nearest-island table
 * made from it once) and the grey. An edit bakes the changed maps only. A map is consistent when it equals what a full bake of the session's inputs gives at every texel; only then is
 * just the dirty region recomputed (R7). The first bake of a map, a grey added, removed or replaced, and an edit that changes every label or the feather all recompute every texel, by
 * the same code as the one-shot job, so the bytes are those of the full bake (R1). The reply holds fresh copies; the session keeps its own as the next base (R6).
 */
export class BakeSessionState {
  private readonly size: number;
  private readonly tile: number;
  private readonly labels: Uint8Array;
  private readonly maps: { rough: Uint8Array; metal: Uint8Array };
  private readonly table: Int32Array | null;
  private readonly reach: number;
  private grey: Uint8Array | null;
  private readonly consistent: Record<MapName, boolean> = { rough: false, metal: false };
  private meansCache: { key: string; means: Float64Array } | null = null;
  private last: LastEdit = { path: 'full', share: 1 };

  constructor(start: SessionStart, options: { tile?: number } = {}) {
    this.size = start.size;
    this.tile = options.tile ?? REGION_TILE;
    this.labels = start.labels;
    this.maps = start.maps;
    this.grey = start.grey ?? null;
    this.table = start.coverage === undefined ? null : computeNearestIslandTexels(start.coverage, start.size);
    this.reach = start.coverage === undefined ? 0 : gutterReach(start.size);
  }

  /** The grey was added, removed or replaced: it changes the grain of every row with the Colour mixin, so no map is consistent until it is baked in full again (R7). */
  setGrey(grey: Uint8Array | null): void {
    this.grey = grey;
    this.consistent.rough = false;
    this.consistent.metal = false;
    this.meansCache = null;
  }

  lastEdit(): LastEdit {
    return this.last;
  }

  edit(request: SessionEdit): Partial<Record<MapName, Uint8Array>> {
    const radius = Math.min(Math.max(Math.round(request.feather), 0), MAX_FEATHER);
    const useRegion = request.changedLabels !== 'all' && request.maps.some((which) => this.consistent[which]);
    const region = useRegion ? computeDirtyRegion({ labels: this.labels, side: this.size, rowCount: request.rows.length, changedLabels: request.changedLabels as number[], radius, reach: this.reach, tile: this.tile }) : null;
    const means = this.meansFor(request.rows);
    const reply: Partial<Record<MapName, Uint8Array>> = {};
    let full = false;
    for (const which of NAMES) {
      if (!request.maps.includes(which)) continue;
      if (region !== null && this.consistent[which]) this.bakeRegion(which, request, region, means);
      else {
        this.bakeAll(which, request, means);
        full = true;
      }
      this.consistent[which] = true;
      reply[which] = this.maps[which].slice();
    }
    this.last = full || region === null ? { path: 'full', share: 1 } : { path: 'region', share: region.share };
    return reply;
  }

  private image(data: Uint8Array, width = this.size, height = this.size): PixelImage {
    return { width, height, channels: 1, data };
  }

  /** The mean grey of each row over the whole picture, when a row has the Colour mixin and there is a grey; the grain of a crop is relative to it. */
  private meansFor(rows: readonly BakeRow[]): Float64Array | undefined {
    if (this.grey === null || !rows.some((row) => row.mix !== undefined)) return undefined;
    const key = rows.map((row) => (row.mix === undefined ? '0' : '1')).join('');
    if (this.meansCache?.key !== key) this.meansCache = { key, means: meanGreyPerRow(this.image(this.labels), this.image(this.grey), rows.map((row) => row.mix)) };
    return this.meansCache.means;
  }

  private bakeAll(which: MapName, { rows, feather }: SessionEdit, means: Float64Array | undefined): void {
    const baked = bakeNamedMasks(
      { labels: this.image(this.labels), rows, feather, edges: 'clamp', base: { rough: this.image(this.maps.rough), metal: this.image(this.maps.metal) }, ...(this.grey === null ? {} : { grey: this.image(this.grey) }), ...(means === undefined ? {} : { means }) },
      [which],
    )[which]!;
    this.maps[which] = this.table === null ? baked.data : fillGutterFromTable([baked], this.table)[0]!.data;
  }

  private crop(source: Uint8Array, x0: number, y0: number, width: number, height: number): Uint8Array {
    const out = new Uint8Array(width * height);
    for (let y = 0; y < height; y += 1) out.set(source.subarray((y0 + y) * this.size + x0, (y0 + y) * this.size + x0 + width), y * width);
    return out;
  }

  /** The dirty tiles are baked from a crop with a halo of the feather radius, so each texel reads the neighbours it reads in the whole picture; the gutter is then refilled from the table in the tiles to fill. */
  private bakeRegion(which: MapName, { rows, feather }: SessionEdit, region: DirtyRegion, means: Float64Array | undefined): void {
    const { tile, tilesAcross } = region;
    const radius = Math.min(Math.max(Math.round(feather), 0), MAX_FEATHER);
    const map = this.maps[which];
    for (let tileRow = 0; tileRow < tilesAcross; tileRow += 1) {
      for (let tileColumn = 0; tileColumn < tilesAcross; tileColumn += 1) {
        if (region.bake[tileRow * tilesAcross + tileColumn] !== 1) continue;
        const x0 = tileColumn * tile;
        const y0 = tileRow * tile;
        const x1 = Math.min(this.size, x0 + tile);
        const y1 = Math.min(this.size, y0 + tile);
        const cx0 = Math.max(0, x0 - radius);
        const cy0 = Math.max(0, y0 - radius);
        const cx1 = Math.min(this.size, x1 + radius);
        const cy1 = Math.min(this.size, y1 + radius);
        const width = cx1 - cx0;
        const height = cy1 - cy0;
        const cropped = this.image(this.crop(map, cx0, cy0, width, height), width, height);
        const baked = bakeNamedMasks(
          { labels: this.image(this.crop(this.labels, cx0, cy0, width, height), width, height), rows, feather, edges: 'clamp', base: { rough: cropped, metal: cropped }, ...(this.grey === null ? {} : { grey: this.image(this.crop(this.grey, cx0, cy0, width, height), width, height) }), ...(means === undefined ? {} : { means }) },
          [which],
        )[which]!.data;
        for (let y = y0; y < y1; y += 1) map.set(baked.subarray((y - cy0) * width + (x0 - cx0), (y - cy0) * width + (x1 - cx0)), y * this.size + x0);
      }
    }
    if (this.table === null) return;
    for (let tileRow = 0; tileRow < tilesAcross; tileRow += 1) {
      for (let tileColumn = 0; tileColumn < tilesAcross; tileColumn += 1) {
        if (region.fill[tileRow * tilesAcross + tileColumn] !== 1) continue;
        const x1 = Math.min(this.size, (tileColumn + 1) * tile);
        const y1 = Math.min(this.size, (tileRow + 1) * tile);
        for (let y = tileRow * tile; y < y1; y += 1) {
          for (let x = tileColumn * tile; x < x1; x += 1) {
            const source = this.table[y * this.size + x]!;
            if (source >= 0) map[y * this.size + x] = map[source]!;
          }
        }
      }
    }
  }
}
