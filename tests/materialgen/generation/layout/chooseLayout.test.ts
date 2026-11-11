import { describe, expect, it } from 'vitest';
import type { CanvasRule } from '@shared/generation/catalog/canvasRules';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { chooseLayout, gridName, MIN_TILE_SIDE_PX, TILE_GAP_PX } from '@mat/generation/layout/chooseLayout';

const rule = (id: string): CanvasRule => KNOWN_MODELS.find((model) => model.id === id)!.canvases!;
const gpt = rule('gpt-image-2.5-sunburst');
const gemini = rule('gemini-nano-banana-2.1');
const listRule = (canvases: Array<[number, number]>): CanvasRule => ({ kind: 'list', byResolution: { '1K': canvases.map(([width, height]) => ({ width, height })) } });

const choose = (canvasRule: CanvasRule | undefined, key: string, count: number) => {
  const choice = chooseLayout(canvasRule, key, count);
  if (!choice.ok) throw new Error(`refused: ${choice.reason}`);
  return choice.layout;
};

describe('materialgen/generation R21 R23 layouts', () => {
  it('R21 a lone map is 1x1 on the squarest canvas and its tile is the whole canvas, with no gap and no margin (R23)', () => {
    const layout = choose(gemini, '1K', 1);
    expect(gridName(layout.grid)).toBe('1x1');
    expect(layout.canvas).toEqual({ width: 1024, height: 1024 });
    expect(layout.tiles).toEqual([{ x: 0, y: 0, width: 1024, height: 1024 }]);
    expect(layout.emptyCells).toBe(0);
  });

  it('R21 more than three maps have no layout: the decomposition never shares an image', () => {
    expect(chooseLayout(gpt, '1K', 4)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
    expect(chooseLayout(gpt, '1K', 0)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
  });

  it('R23 on a GPT model at 2K three maps are judged 3x1 against 2x2 by tile side, and the larger wins', () => {
    const layout = choose(gpt, '2K', 3);
    expect(gridName(layout.grid)).toBe('3x1');
    expect(layout.tileSide).toBeGreaterThan(1016); // the 2x2 on the 2048 square would give (2048 - 16) / 2
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(2048 * 2048);
  });

  it('R23 ties prefer fewer empty cells: 3x1 on 932x300 and 2x2 on 616x616 both give tiles of 300, and 3x1 has no empty cell', () => {
    const layout = choose(listRule([[616, 616], [932, 300]]), '1K', 3);
    expect(layout.tileSide).toBe(300);
    expect(gridName(layout.grid)).toBe('3x1');
    expect(layout.emptyCells).toBe(0);
  });

  it('R23 then fewer canvas pixels: of two canvases that give the same tiles the smaller is requested', () => {
    const layout = choose(listRule([[700, 300], [632, 300]]), '1K', 2);
    expect(layout.canvas).toEqual({ width: 632, height: 300 });
    expect(layout.tileSide).toBe(300);
  });

  it('R23 then the grid listed first: 2x1 before 1x2 on canvases of the same area', () => {
    const layout = choose(listRule([[300, 632], [632, 300]]), '1K', 2);
    expect(gridName(layout.grid)).toBe('2x1');
  });

  it('R23 a Gemini model with no 2:1 ratio packs two maps on the nearest listed ratios by tile side, leaving the rest as margin', () => {
    const layout = choose(gemini, '1K', 2);
    expect(layout.tileSide).toBe(504); // (1024 - 16) / 2 on the 16:9 canvas 1024 x 576
    expect(gridName(layout.grid)).toBe('2x1');
    expect(layout.canvas).toEqual({ width: 1024, height: 576 });
  });

  it('R23 the tiles are squares of one side, separated by the 16 px gap, centred, in reading order, and inside the canvas', () => {
    const layout = choose(listRule([[932, 300]]), '1K', 3);
    expect(layout.tiles).toEqual([
      { x: 0, y: 0, width: 300, height: 300 },
      { x: 316, y: 0, width: 300, height: 300 },
      { x: 632, y: 0, width: 300, height: 300 },
    ]);
    expect(layout.tiles[1]!.x - (layout.tiles[0]!.x + layout.tiles[0]!.width)).toBe(TILE_GAP_PX);
    const centred = choose(listRule([[1000, 400]]), '1K', 2);
    const [first, second] = centred.tiles as [typeof centred.tiles[0], typeof centred.tiles[0]];
    expect(first.x).toBe(1000 - (second.x + second.width)); // the margin is the same on both sides
    for (const tile of centred.tiles) {
      expect(tile.x).toBeGreaterThanOrEqual(0);
      expect(tile.x + tile.width).toBeLessThanOrEqual(1000);
      expect(tile.y + tile.height).toBeLessThanOrEqual(400);
    }
  });

  it('R21 in 2x2 the fourth cell is empty and three tiles are placed in reading order', () => {
    const layout = choose(listRule([[616, 616]]), '1K', 3);
    expect(gridName(layout.grid)).toBe('2x2');
    expect(layout.emptyCells).toBe(1);
    expect(layout.tiles).toHaveLength(3);
    expect(layout.tiles[2]!.y).toBeGreaterThan(layout.tiles[0]!.y); // the third map starts the second row
    expect(layout.tiles[2]!.x).toBe(layout.tiles[0]!.x);
  });
});

describe('materialgen/generation R22 R25 canvases and too-small packs', () => {
  it('R22 the canvases come only from the catalog rule: no rule or no canvas at the key is a refusal, not a guess', () => {
    expect(chooseLayout(undefined, '1K', 1)).toEqual({ ok: false, reason: 'no-canvas', tileSide: 0 });
    expect(chooseLayout(gpt, '4K', 2)).toEqual({ ok: false, reason: 'no-canvas', tileSide: 0 }); // OpenAI has no 4K key
  });

  it('R25 a pack whose best tile side is under 256 px is refused, and the measure comes back for the message', () => {
    const choice = chooseLayout(listRule([[600, 300]]), '1K', 3);
    expect(choice.ok).toBe(false);
    if (!choice.ok) {
      expect(choice.reason).toBe('tiles-too-small');
      expect(choice.tileSide).toBeLessThan(MIN_TILE_SIDE_PX);
      expect(choice.tileSide).toBe(189); // 3x1: (600 - 32) / 3 rounded down
    }
  });

  it('R25 a tile of exactly 256 px is allowed', () => {
    const layout = choose(listRule([[800, 256]]), '1K', 3);
    expect(layout.tileSide).toBe(MIN_TILE_SIDE_PX);
  });

  it('R14 the same input always gives the same layout, so the overlay preview and the run cannot disagree', () => {
    expect(chooseLayout(gpt, '2K', 3)).toEqual(chooseLayout(gpt, '2K', 3));
  });
});
