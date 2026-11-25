import { MAX_FEATHER, bakeNamedMasks, type BakeRow } from '../bake/bakeMasks';
import { bakeTexelRegion } from '../bake/bakeTexelRegion';
import { meanGreyPerRow } from '../bake/colourMixin';
import type { MapName } from '../bake/diffBakedRows';
import type { MapRect, MapResult } from '../bake/mapResult';
import { computeNearestIslandTexels, fillGutterFromTable } from '../bake/nearestIslandTexels';
import { TexelRegion } from '../bake/texelRegion';
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
  share: number; // the fraction of the picture's texels recomputed (1 on a full bake)
}

const NAMES: readonly MapName[] = ['rough', 'metal'];

/**
 * Mask-bake-session R5, R6, R7, R9: the worker-side state of one open masks record. It owns copies of the labels, the two current maps, the island coverage (with the nearest-island table
 * made from it once) and the grey. An edit bakes the changed maps only. A map is consistent when it equals what a full bake of the session's inputs gives at every texel; only then are
 * just the texels the changed labels reach recomputed (R7, per texel). The first bake of a map, a grey added, removed or replaced, and an edit that changes every label or the feather all
 * recompute every texel, by the same code as the one-shot job, so the bytes are those of the full bake (R1). A full bake answers the whole map, a region bake only the touched rectangles
 * (R6); the session keeps its own map as the next base.
 */
export class BakeSessionState {
  private readonly size: number;
  private readonly labels: Uint8Array;
  private readonly maps: { rough: Uint8Array; metal: Uint8Array };
  private readonly table: Int32Array | null;
  private region: TexelRegion | null = null; // built at the first region bake
  private grey: Uint8Array | null;
  private readonly consistent: Record<MapName, boolean> = { rough: false, metal: false };
  private meansCache: { key: string; means: Float64Array } | null = null;
  private lastFeather: number | null = null;
  private last: LastEdit = { path: 'full', share: 1 };

  constructor(start: SessionStart) {
    this.size = start.size;
    this.labels = start.labels;
    this.maps = start.maps;
    this.grey = start.grey ?? null;
    this.table = start.coverage === undefined ? null : computeNearestIslandTexels(start.coverage, start.size);
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

  edit(request: SessionEdit): Partial<Record<MapName, MapResult>> {
    const feather = Math.min(Math.max(Math.round(request.feather), 0), MAX_FEATHER);
    if (this.lastFeather !== feather) {
      this.lastFeather = feather;
      this.consistent.rough = false; // R7: a feather change recomputes every texel
      this.consistent.metal = false;
    }
    const changed = request.changedLabels === 'all' ? null : request.changedLabels;
    const means = this.meansFor(request.rows);
    const reply: Partial<Record<MapName, MapResult>> = {};
    let full = false;
    let texels = 0;
    for (const which of NAMES) {
      if (!request.maps.includes(which)) continue;
      if (changed !== null && this.consistent[which]) {
        const touched = bakeTexelRegion(this.regionOf(), { rows: request.rows, feather, which, changed, map: this.maps[which], grey: this.grey, means });
        texels = Math.max(texels, touched.texels);
        const area = touched.rects.reduce((sum, rect) => sum + (rect.x1 - rect.x0) * (rect.y1 - rect.y0), 0);
        // R6: past half the picture, rectangles cost more than the map
        reply[which] = area * 2 > this.size * this.size ? { kind: 'whole', bytes: this.maps[which].slice() } : { kind: 'rects', rects: touched.rects.map((rect) => this.rectBytes(this.maps[which], rect)) };
      } else {
        this.bakeAll(which, request, means);
        full = true;
        reply[which] = { kind: 'whole', bytes: this.maps[which].slice() };
      }
      this.consistent[which] = true;
    }
    this.last = full ? { path: 'full', share: 1 } : { path: 'region', share: texels / (this.size * this.size) };
    return reply;
  }

  private regionOf(): TexelRegion {
    this.region ??= new TexelRegion(this.labels, this.size, this.table);
    return this.region;
  }

  private rectBytes(map: Uint8Array, rect: { x0: number; y0: number; x1: number; y1: number }): MapRect {
    const width = rect.x1 - rect.x0;
    const bytes = new Uint8Array(width * (rect.y1 - rect.y0));
    for (let y = rect.y0; y < rect.y1; y += 1) bytes.set(map.subarray(y * this.size + rect.x0, y * this.size + rect.x1), (y - rect.y0) * width);
    return { ...rect, bytes };
  }

  private image(data: Uint8Array): PixelImage {
    return { width: this.size, height: this.size, channels: 1, data };
  }

  /** The mean grey of each row over the whole picture, when a row has the Colour mixin and there is a grey; the grain of a region is relative to it. */
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
}
