import { describe, expect, it } from 'vitest';
import { KNOWN_MODELS } from '../../../src/generation/catalog/knownModels';
import { listCanvases, type CanvasRule } from '../../../src/generation/catalog/canvasRules';

const model = (id: string) => {
  const entry = KNOWN_MODELS.find((candidate) => candidate.id === id);
  if (!entry?.canvases) throw new Error(`no canvases for ${id}`);
  return entry.canvases;
};

describe('listCanvases', () => {
  it('custom R12 a list rule gives exactly the sizes of that resolution key, copied', () => {
    const rule: CanvasRule = { kind: 'list', byResolution: { '1K': [{ width: 1024, height: 1024 }, { width: 1536, height: 1024 }] } };
    const first = listCanvases(rule, '1K');
    expect(first).toEqual([{ width: 1024, height: 1024 }, { width: 1536, height: 1024 }]);
    first[0]!.width = 1;
    expect(listCanvases(rule, '1K')[0]!.width).toBe(1024);
  });

  it('custom R12 a resolution key the rule does not know gives no canvas', () => {
    const rule: CanvasRule = { kind: 'list', byResolution: { '1K': [{ width: 1024, height: 1024 }] } };
    expect(listCanvases(rule, '4K')).toEqual([]);
  });

  it('custom R12 a budget rule gives sides in multiples of the step, inside the pixel cap, edge cap and ratio cap', () => {
    const rule: CanvasRule = { kind: 'budget', byResolution: { '1K': { minPixels: 655_360, maxPixels: 1_048_576, step: 16, maxRatio: 3, maxEdge: 3840 } } };
    const canvases = listCanvases(rule, '1K');
    expect(canvases.length).toBeGreaterThan(5);
    for (const { width, height } of canvases) {
      expect(width % 16).toBe(0);
      expect(height % 16).toBe(0);
      expect(width * height).toBeLessThanOrEqual(1_048_576);
      expect(width * height).toBeGreaterThanOrEqual(655_360);
      expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(3);
      expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
    }
  });

  it('custom R12 a budget rule offers the square, a 2:3 portrait and a 3:1 extreme', () => {
    const rule: CanvasRule = { kind: 'budget', byResolution: { '1K': { minPixels: 655_360, maxPixels: 1_048_576, step: 16, maxRatio: 3, maxEdge: 3840 } } };
    const aspects = listCanvases(rule, '1K').map(({ width, height }) => width / height);
    expect(aspects.some((aspect) => Math.abs(aspect - 1) < 0.01)).toBe(true);
    expect(aspects.some((aspect) => Math.abs(aspect - 2 / 3) < 0.01)).toBe(true);
    expect(aspects.some((aspect) => Math.abs(aspect - 3) < 0.01)).toBe(true);
  });

  it('custom R12 a budget rule adds the ideal aspect and clamps it to the ratio cap', () => {
    const rule: CanvasRule = { kind: 'budget', byResolution: { '1K': { minPixels: 655_360, maxPixels: 1_048_576, step: 16, maxRatio: 3, maxEdge: 3840 } } };
    const near = listCanvases(rule, '1K', 0.8).map(({ width, height }) => width / height);
    expect(near.some((aspect) => Math.abs(aspect - 0.8) < 0.01)).toBe(true);
    const clamped = listCanvases(rule, '1K', 10).map(({ width, height }) => width / height);
    expect(Math.max(...clamped)).toBeLessThanOrEqual(3.01);
  });

  it('custom R12 the output is deterministic and has no duplicates', () => {
    const rule: CanvasRule = { kind: 'budget', byResolution: { '2K': { minPixels: 655_360, maxPixels: 4_194_304, step: 16, maxRatio: 3, maxEdge: 3840 } } };
    const one = listCanvases(rule, '2K', 0.75);
    expect(listCanvases(rule, '2K', 0.75)).toEqual(one);
    expect(new Set(one.map(({ width, height }) => `${width}x${height}`)).size).toBe(one.length);
  });
});

describe('the model table canvases', () => {
  it('custom R12 every image model has canvases for each of its resolution keys', () => {
    for (const entry of KNOWN_MODELS.filter((candidate) => candidate.role === 'image')) {
      expect(entry.canvases, entry.id).toBeDefined();
      for (const { key } of entry.resolutions) expect(listCanvases(entry.canvases!, key).length, `${entry.id} ${key}`).toBeGreaterThan(0);
    }
  });

  it('custom R12 a text model has no canvases', () => {
    for (const entry of KNOWN_MODELS.filter((candidate) => candidate.role === 'vision-text')) expect(entry.canvases).toBeUndefined();
  });

  it('custom R12 OpenAI sunburst at 1K and 2K stays inside the documented limits and offers 1:1', () => {
    const rule = model('gpt-image-2.5-sunburst');
    for (const key of ['1K', '2K']) {
      const canvases = listCanvases(rule, key);
      const square = key === '1K' ? 1024 : 2048;
      expect(canvases).toContainEqual({ width: square, height: square });
      for (const { width, height } of canvases) {
        expect(width % 16).toBe(0);
        expect(height % 16).toBe(0);
        expect(Math.max(width, height)).toBeLessThanOrEqual(3840);
        expect(width * height).toBeLessThanOrEqual(8_294_400);
        expect(width * height).toBeGreaterThanOrEqual(655_360);
        expect(Math.max(width, height) / Math.min(width, height)).toBeLessThanOrEqual(3);
      }
    }
  });

  it('custom R12 Gemini canvases are the documented aspect ratios with the long side at the size key', () => {
    const canvases = listCanvases(model('gemini-nano-banana-2.1'), '2K');
    expect(canvases).toContainEqual({ width: 2048, height: 2048 });
    expect(canvases).toContainEqual({ width: 2048, height: 1365 });
    expect(canvases).toContainEqual({ width: 1152, height: 2048 });
    for (const { width, height } of canvases) expect(Math.max(width, height)).toBe(2048);
    expect(canvases).toHaveLength(10);
  });

  it('custom R12 the Flash Lite image model offers 1K only', () => {
    const rule = model('gemini-3.1-flash-lite-image');
    expect(listCanvases(rule, '1K').length).toBeGreaterThan(0);
    expect(listCanvases(rule, '2K')).toEqual([]);
  });
});
