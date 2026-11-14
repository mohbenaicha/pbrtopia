import { describe, expect, it } from 'vitest';
import { DEFAULT_BRUSH } from '../../../../src/materialgen/compositing/plan/brushParams';
import { createStrokeLog, type StrokeHeader } from '../../../../src/materialgen/compositing/session/strokeLog';

const material = { albedo: [1, 2, 3] as const, roughness: 4, metalness: 5 };
const header = (id: number, over: Partial<StrokeHeader['settings']> = {}): StrokeHeader => ({
  id, seed: id * 7, params: DEFAULT_BRUSH, shapes: [{ index: 0, invert: false }],
  settings: { material, height: null, edgeBurn: null, ...over },
});

describe('materialgen/compositing stroke log (R22 R71)', () => {
  it('R71 a stroke keeps its seed, settings and the path it was drawn along', () => {
    const log = createStrokeLog();
    log.begin(header(1));
    log.extend({ x: 0.1, y: 0.2 });
    log.extend({ x: 0.3, y: 0.4 });
    log.end(true);
    expect(log.lastApplied()).toMatchObject({ id: 1, seed: 7, path: [{ x: 0.1, y: 0.2 }, { x: 0.3, y: 0.4 }] });
  });

  it('R22 the applied strokes decide which maps Done writes: colour maps always, height and normal only when a stroke used them', () => {
    const log = createStrokeLog();
    expect(log.appliedMaps()).toEqual([]);
    log.begin(header(1)); log.end(true);
    expect(log.appliedMaps()).toEqual(['albedo', 'rough', 'metal']);
    log.begin(header(2, { height: { mode: 'replace', value: 0.5 } })); log.end(true);
    log.begin(header(3, { edgeBurn: { direction: 'raise' } })); log.end(true);
    expect(log.appliedMaps()).toEqual(['albedo', 'rough', 'metal', 'height', 'normal']);
  });

  it('R22 strokes undone away do not count, and redo counts them again', () => {
    const log = createStrokeLog();
    log.begin(header(1, { height: { mode: 'add', value: 0.1 } })); log.end(true);
    expect(log.undo()?.id).toBe(1);
    expect(log.appliedMaps()).toEqual([]);
    expect(log.undo()).toBeNull();
    expect(log.redo()?.id).toBe(1);
    expect(log.appliedMaps()).toContain('height');
  });

  it('R21 a new stroke clears redo', () => {
    const log = createStrokeLog();
    log.begin(header(1)); log.end(true);
    log.undo();
    log.begin(header(2)); log.end(true);
    expect(log.redoDepth()).toBe(0);
    expect(log.redo()).toBeNull();
  });

  it('R21 strokes dropped from the undo stack, and a stroke too large to undo, still count as applied', () => {
    const log = createStrokeLog();
    log.begin(header(1, { height: { mode: 'add', value: 0.1 } })); log.end(true);
    log.begin(header(2)); log.end(true);
    log.forgetOldestUndo();
    expect(log.undoDepth()).toBe(1);
    expect(log.appliedMaps()).toContain('height');
    log.begin(header(3, { edgeBurn: { direction: 'dent' } })); log.end(false); // too large to undo
    expect(log.undoDepth()).toBe(1);
    expect(log.appliedMaps()).toContain('normal');
    log.dropUndoHistory();
    expect(log.undoDepth()).toBe(0);
    expect(log.appliedMaps()).toEqual(['albedo', 'rough', 'metal', 'height', 'normal']);
  });
});
