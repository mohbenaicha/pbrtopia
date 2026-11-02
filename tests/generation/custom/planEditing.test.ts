import { describe, expect, it } from 'vitest';
import {
  addSheet,
  applySettingsToAll,
  assignCamera,
  countImages,
  describePlanProblem,
  removeSheet,
  reorderSheets,
  setAuxIncluded,
  unassignCamera,
  updateSheetSettings,
} from '../../../src/generation/custom/planEditing';
import type { CustomPlanRecord, SheetSettings } from '../../../src/generation/custom/planTypes';

const settings: SheetSettings = { provider: 'openai', modelId: 'gpt-image-2.5-sunburst', resolutionKey: '1K', quality: 'low' };
const other: SheetSettings = { provider: 'gemini', modelId: 'gemini-nano-banana-2.1', resolutionKey: '2K', quality: 'minimal' };
const plan = (sheets: number[][], aux: SheetSettings | null = null): CustomPlanRecord => ({
  sheets: sheets.map((cameras) => ({ cameras, settings })),
  aux: aux ? { settings: aux } : null,
});

describe('assignCamera', () => {
  it('custom R3 puts a camera on a sheet', () => {
    expect(assignCamera(plan([[0], []]), 3, 1).sheets.map((s) => s.cameras)).toEqual([[0], [3]]);
  });

  it('custom R3 moves an assigned camera and never duplicates it', () => {
    const moved = assignCamera(plan([[0, 2], [1]]), 2, 1);
    expect(moved.sheets.map((s) => s.cameras)).toEqual([[0], [1, 2]]);
  });

  it('custom R3 keeps the cameras of a sheet in core order', () => {
    expect(assignCamera(plan([[3, 5]]), 1, 0).sheets[0]!.cameras).toEqual([1, 3, 5]);
  });

  it('custom R3 a sheet index that does not exist changes nothing', () => {
    const before = plan([[0]]);
    expect(assignCamera(before, 2, 4)).toEqual(before);
  });

  it('custom R3 does not change the plan it was given', () => {
    const before = plan([[0], [1]]);
    assignCamera(before, 0, 1);
    expect(before.sheets.map((s) => s.cameras)).toEqual([[0], [1]]);
  });
});

describe('unassignCamera', () => {
  it('custom R3 dropping on the snapshot row unassigns the camera', () => {
    const next = unassignCamera(plan([[0, 2], [1]]), 2);
    expect(next.sheets.map((s) => s.cameras)).toEqual([[0], [1]]);
  });
});

describe('applySettingsToAll (custom R5, sync settings)', () => {
  it('custom R5 sets the same settings on every sheet and on the aux sheet, and keeps the cameras', () => {
    const next = applySettingsToAll(plan([[0], [1, 2]], settings), other);
    expect(next.sheets.map((s) => s.settings)).toEqual([other, other]);
    expect(next.aux).toEqual({ settings: other });
    expect(next.sheets.map((s) => s.cameras)).toEqual([[0], [1, 2]]);
  });

  it('custom R5 a plan with no aux sheet stays without one, and the given plan is not changed', () => {
    const before = plan([[0]]);
    expect(applySettingsToAll(before, other).aux).toBeNull();
    expect(before.sheets[0]!.settings).toEqual(settings);
  });
});

describe('addSheet, removeSheet, reorderSheets', () => {
  it('custom R5 a new sheet is empty and starts with the settings of the previous one', () => {
    const next = addSheet({ sheets: [{ cameras: [0], settings: other }], aux: null }, settings);
    expect(next.sheets[1]).toEqual({ cameras: [], settings: other });
  });

  it('custom R5 the first sheet of an empty plan takes the default settings', () => {
    expect(addSheet({ sheets: [], aux: null }, settings).sheets).toEqual([{ cameras: [], settings }]);
  });

  it('custom R5 Add image stops at 6 core sheets', () => {
    let current = plan([[0], [1], [2], [3], [4], [5]]);
    current = addSheet(current, settings);
    expect(current.sheets).toHaveLength(6);
  });

  it('custom R5 removing a sheet unassigns its cameras', () => {
    const next = removeSheet(plan([[0], [1, 2]]), 1);
    expect(next.sheets.map((s) => s.cameras)).toEqual([[0]]);
  });

  it('custom R5 a reorder moves a card and the first card is the lead', () => {
    const next = reorderSheets(plan([[0], [2], [1, 3]]), 2, 0);
    expect(next.sheets.map((s) => s.cameras)).toEqual([[1, 3], [0], [2]]);
  });

  it('custom R5 a reorder out of range changes nothing', () => {
    const before = plan([[0], [2]]);
    expect(reorderSheets(before, 0, 5)).toEqual(before);
  });
});

describe('countImages', () => {
  it('custom R1 counts the core sheets plus the aux sheet', () => {
    expect(countImages(plan([[0], [1]]))).toBe(2);
    expect(countImages(plan([[0], [1]], settings))).toBe(3);
  });
});

describe('describePlanProblem', () => {
  const available = () => null;

  it('custom R1 an empty plan asks for a camera', () => {
    expect(describePlanProblem(plan([]), available)).toBe('Assign at least one camera to an image.');
    expect(describePlanProblem(plan([[], []]), available)).toBe('Assign at least one camera to an image.');
  });

  it('custom R7 a core sheet with no camera is named', () => {
    expect(describePlanProblem(plan([[0], []]), available)).toBe('Image 2 has no camera.');
  });

  it('custom R7 an unavailable model gives the reason of the check, with the image number', () => {
    const reason = (s: SheetSettings) => (s.provider === 'gemini' ? 'Add a Gemini key in Settings.' : null);
    const mixed: CustomPlanRecord = { sheets: [{ cameras: [0], settings }, { cameras: [1], settings: other }], aux: null };
    expect(describePlanProblem(mixed, reason)).toBe('Image 2: Add a Gemini key in Settings.');
  });

  it('custom R7 the aux sheet is checked too', () => {
    const reason = (s: SheetSettings) => (s.modelId === 'gone' ? 'This model is not available.' : null);
    const withAux = plan([[0]], { ...settings, modelId: 'gone' });
    expect(describePlanProblem(withAux, reason)).toBe('Auxiliary image: This model is not available.');
  });

  it('custom R7 a valid plan has no problem, and a single camera is allowed', () => {
    expect(describePlanProblem(plan([[0]]), available)).toBeNull();
    expect(describePlanProblem(plan([[0, 1, 2], [3, 4, 5]], settings), available)).toBeNull();
  });
});

describe('updateSheetSettings', () => {
  it('custom R5 changes the settings of one core sheet and leaves the rest', () => {
    const next = updateSheetSettings(plan([[0], [1]], settings), 1, other);
    expect(next.sheets.map((s) => s.settings)).toEqual([settings, other]);
    expect(next.aux?.settings).toEqual(settings);
  });

  it('custom R5 changes the aux sheet\'s settings with "aux"', () => {
    const next = updateSheetSettings(plan([[0]], settings), 'aux', other);
    expect(next.aux?.settings).toEqual(other);
    expect(next.sheets[0]?.settings).toEqual(settings);
  });

  it('custom R5 a sheet that does not exist, or an aux sheet that is off, changes nothing', () => {
    const base = plan([[0]]);
    expect(updateSheetSettings(base, 4, other)).toBe(base);
    expect(updateSheetSettings(base, 'aux', other)).toBe(base);
  });
});

describe('setAuxIncluded', () => {
  it('custom R5 turning it on adds an aux sheet with the last sheet\'s settings, or the given defaults when there is no sheet', () => {
    expect(setAuxIncluded(plan([[0]]), true, other).aux?.settings).toEqual(settings);
    expect(setAuxIncluded(plan([]), true, other).aux?.settings).toEqual(other);
  });

  it('custom R5 turning it off removes it; turning it on again when it is on keeps its settings', () => {
    expect(setAuxIncluded(plan([[0]], settings), false, other).aux).toBeNull();
    const withAux = plan([[0]], other);
    expect(setAuxIncluded(withAux, true, settings)).toBe(withAux);
  });
});
