import { describe, expect, it } from 'vitest';
import type { CanvasRule } from '@shared/generation/catalog/canvasRules';
import { KNOWN_MODELS } from '@shared/generation/catalog/knownModels';
import { chooseLayout, gridName, MIN_TILE_SIDE_PX } from '@mat/generation/layout/chooseLayout';

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

  it('R21 more than two maps have no layout: three maps are refused, and the decomposition never shares an image', () => {
    expect(chooseLayout(gpt, '1K', 3)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
    expect(chooseLayout(gpt, '1K', 4)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
    expect(chooseLayout(gpt, '1K', 0)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
  });

  it('R23 on a GPT model at 2K two maps are judged 2x1 against 1x2 by tile side, and the larger wins', () => {
    const layout = choose(gpt, '2K', 2);
    expect(layout.tileSide).toBeGreaterThan(1024); // a cell of the 2048 square would give 2048 / 2
    expect(layout.canvas.width * layout.canvas.height).toBeLessThanOrEqual(2048 * 2048);
    expect(layout.emptyCells).toBe(0);
  });

  it('R23 the larger tile side wins across canvases: 2x1 on 1200x600 gives tiles of 600, against 300 on the square', () => {
    const layout = choose(listRule([[600, 600], [1200, 600]]), '1K', 2);
    expect(layout.tileSide).toBe(600);
    expect(gridName(layout.grid)).toBe('2x1');
    expect(layout.canvas).toEqual({ width: 1200, height: 600 });
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

  it('R23 a Gemini model with no 2:1 ratio packs two maps on the nearest listed ratios by tile side, the cells simply dividing that canvas', () => {
    const layout = choose(gemini, '1K', 2);
    expect(layout.tileSide).toBe(512); // the shorter side of the 512 x 576 cells of the 16:9 canvas 1024 x 576
    expect(gridName(layout.grid)).toBe('2x1');
    expect(layout.canvas).toEqual({ width: 1024, height: 576 });
  });

  it('R23 the tiles are equal cells that touch: no gap, no margin, in reading order, covering the canvas', () => {
    const tall = choose(listRule([[400, 1000]]), '1K', 2);
    expect(gridName(tall.grid)).toBe('1x2');
    expect(tall.tiles).toEqual([
      { x: 0, y: 0, width: 400, height: 500 },
      { x: 0, y: 500, width: 400, height: 500 },
    ]);
    const wide = choose(listRule([[1000, 400]]), '1K', 2);
    expect(wide.tiles).toEqual([
      { x: 0, y: 0, width: 500, height: 400 },
      { x: 500, y: 0, width: 500, height: 400 },
    ]);
    expect(wide.tileSide).toBe(400);
  });

  it('R21 a request for three maps is refused even on a canvas that would hold them', () => {
    expect(chooseLayout(listRule([[900, 300], [616, 616]]), '1K', 3)).toEqual({ ok: false, reason: 'too-many-maps', tileSide: 0 });
  });
});

describe('materialgen/generation R22 R25 canvases and too-small packs', () => {
  it('R22 the canvases come only from the catalog rule: no rule or no canvas at the key is a refusal, not a guess', () => {
    expect(chooseLayout(undefined, '1K', 1)).toEqual({ ok: false, reason: 'no-canvas', tileSide: 0 });
    expect(chooseLayout(gpt, '4K', 2)).toEqual({ ok: false, reason: 'no-canvas', tileSide: 0 }); // OpenAI has no 4K key
  });

  it('R25 a pack whose best tile side is under 256 px is refused, and the measure comes back for the message', () => {
    const choice = chooseLayout(listRule([[400, 200]]), '1K', 2);
    expect(choice.ok).toBe(false);
    if (!choice.ok) {
      expect(choice.reason).toBe('tiles-too-small');
      expect(choice.tileSide).toBeLessThan(MIN_TILE_SIDE_PX);
      expect(choice.tileSide).toBe(200); // 2x1: 400 / 2
    }
  });

  it('R25 a tile of exactly 256 px is allowed', () => {
    const layout = choose(listRule([[512, 256]]), '1K', 2);
    expect(layout.tileSide).toBe(MIN_TILE_SIDE_PX);
  });

  it('R14 the same input always gives the same layout, so the overlay preview and the run cannot disagree', () => {
    expect(chooseLayout(gpt, '2K', 2)).toEqual(chooseLayout(gpt, '2K', 2));
  });
});
