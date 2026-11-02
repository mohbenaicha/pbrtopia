import { MAX_CORE_SHEETS, type CoreSheetPlan, type CustomPlanRecord, type SheetSettings } from './planTypes';

// Custom generation R3, R5, R7: pure edits of a plan. Each returns a new plan and never changes the one it was given.

// R3: a camera belongs to at most one sheet, so assigning moves it. A sheet that does not exist changes nothing.
export function assignCamera(plan: CustomPlanRecord, camera: number, sheetIndex: number): CustomPlanRecord {
  if (sheetIndex < 0 || sheetIndex >= plan.sheets.length) return plan;
  const sheets = plan.sheets.map((sheet, index): CoreSheetPlan => {
    const others = sheet.cameras.filter((candidate) => candidate !== camera);
    return { ...sheet, cameras: index === sheetIndex ? [...others, camera].sort((a, b) => a - b) : others };
  });
  return { ...plan, sheets };
}

export function unassignCamera(plan: CustomPlanRecord, camera: number): CustomPlanRecord {
  return { ...plan, sheets: plan.sheets.map((sheet) => ({ ...sheet, cameras: sheet.cameras.filter((candidate) => candidate !== camera) })) };
}

// R5: a new sheet is empty and starts with the settings of the previous one (the defaults for the first); six core sheets at most.
export function addSheet(plan: CustomPlanRecord, defaults: SheetSettings): CustomPlanRecord {
  if (plan.sheets.length >= MAX_CORE_SHEETS) return plan;
  const previous = plan.sheets[plan.sheets.length - 1];
  return { ...plan, sheets: [...plan.sheets, { cameras: [], settings: { ...(previous?.settings ?? defaults) } }] };
}

// Removing a sheet unassigns its cameras.
export function removeSheet(plan: CustomPlanRecord, index: number): CustomPlanRecord {
  if (index < 0 || index >= plan.sheets.length) return plan;
  return { ...plan, sheets: plan.sheets.filter((_, position) => position !== index) };
}

// R5: the card at `from` moves to `to`; the first card is the lead.
export function reorderSheets(plan: CustomPlanRecord, from: number, to: number): CustomPlanRecord {
  const last = plan.sheets.length - 1;
  if (from < 0 || from > last || to < 0 || to > last || from === to) return plan;
  const sheets = [...plan.sheets];
  const [moved] = sheets.splice(from, 1);
  sheets.splice(to, 0, moved!);
  return { ...plan, sheets };
}

// R5: new settings for one core sheet (its index) or for the aux sheet ('aux'). A sheet that is not there changes nothing.
export function updateSheetSettings(plan: CustomPlanRecord, target: number | 'aux', settings: SheetSettings): CustomPlanRecord {
  if (target === 'aux') return plan.aux === null ? plan : { ...plan, aux: { settings } };
  if (target < 0 || target >= plan.sheets.length) return plan;
  return { ...plan, sheets: plan.sheets.map((sheet, index) => (index === target ? { ...sheet, settings } : sheet)) };
}

// R5, Sync settings: the same settings on every core sheet and on the aux sheet (when there is one).
export function applySettingsToAll(plan: CustomPlanRecord, settings: SheetSettings): CustomPlanRecord {
  return { ...plan, sheets: plan.sheets.map((sheet) => ({ ...sheet, settings: { ...settings } })), aux: plan.aux === null ? null : { settings: { ...settings } } };
}

// R5: the Include auxiliary cameras checkbox. A new aux sheet starts with the settings of the last core sheet (the defaults when there is none).
export function setAuxIncluded(plan: CustomPlanRecord, included: boolean, defaults: SheetSettings): CustomPlanRecord {
  if (!included) return plan.aux === null ? plan : { ...plan, aux: null };
  if (plan.aux !== null) return plan;
  const last = plan.sheets[plan.sheets.length - 1];
  return { ...plan, aux: { settings: { ...(last?.settings ?? defaults) } } };
}

// R1: how many images a run of this plan requests.
export function countImages(plan: CustomPlanRecord): number {
  return plan.sheets.length + (plan.aux ? 1 : 0);
}

// R7: why Confirm and Generate are not possible, or null. `describeUnavailable` is the model, key, canvas and reference check of generate
// R19-R20 and custom R13 for one sheet's settings; `isLead` is true for the first sheet only.
export function describePlanProblem(plan: CustomPlanRecord, describeUnavailable: (settings: SheetSettings, isLead: boolean) => string | null): string | null {
  if (!plan.sheets.some((sheet) => sheet.cameras.length > 0)) return 'Assign at least one camera to an image.';
  const empty = plan.sheets.findIndex((sheet) => sheet.cameras.length === 0);
  if (empty >= 0) return `Image ${empty + 1} has no camera.`;
  for (const [index, sheet] of plan.sheets.entries()) {
    const reason = describeUnavailable(sheet.settings, index === 0);
    if (reason) return `Image ${index + 1}: ${reason}`;
  }
  if (plan.aux) {
    const reason = describeUnavailable(plan.aux.settings, false);
    if (reason) return `Auxiliary image: ${reason}`;
  }
  return null;
}
