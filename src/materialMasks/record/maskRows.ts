import type { BakeRow } from '../bake/bakeMasks';
import type { Component } from '../describe/parseComponents';
import { GENERIC, findMaterial, type BaseMaterialTable } from '../table/baseMaterials';
import type { MatchKind } from '../table/matchMaterials';

/** Masks R41: the panel row of one component, as the masks record keeps it. */
export interface MaskRow {
  label: number;
  name: string;
  description: string;
  location: string;
  defaultMaterial: string; // chosen by the matching (R74) or by the local naming (R27)
  top3: string[];
  matchKind: MatchKind | 'colour' | 'generic';
  material: string; // the base material in use now
  rough: number; // 0 to 1, current
  metal: number; // 0 to 1, current
  height: number; // -1 to +1, 0 in the middle: raises or lowers the Height map under this component (R81)
  mix?: RowMix; // the Colour mixin (R90); a row from before it has none and reads as off (R95)
}

/** Masks R90: the Colour mixin of one row: on or off, Invert, and the two amounts, 0 to 1. */
export interface RowMix {
  on: boolean;
  invert: boolean;
  rough: number;
  metal: number;
}

export const DEFAULT_MIX: Readonly<RowMix> = { on: false, invert: false, rough: 0.5, metal: 0.5 };

interface MakeRowInput {
  label: number;
  component: Component;
  match: { material: string; top3: string[]; kind: MaskRow['matchKind'] };
  table: BaseMaterialTable;
}

const SLIDER_STEP = 100; // 0.01

/** Masks R39, R41: a row that starts with the values of its matched base material, as the file has them (Generic when the name is unknown). */
export function makeRow({ label, component, match, table }: MakeRowInput): MaskRow {
  const material = findMaterial(table, match.material) ?? GENERIC;
  return {
    label,
    name: component.name,
    description: component.description,
    location: component.location,
    defaultMaterial: material.name,
    top3: [...match.top3],
    matchKind: match.kind,
    material: material.name,
    rough: material.roughness,
    metal: material.metal,
    height: 0,
  };
}

/** Masks R40: another base material replaces the row's roughness and metal with its own; the matched default is kept for Reset. */
export function chooseMaterial(row: MaskRow, name: string, table: BaseMaterialTable): MaskRow {
  const material = findMaterial(table, name);
  return material === undefined ? row : { ...row, material: material.name, rough: material.roughness, metal: material.metal };
}

/**
 * Masks R50, R81: a slider value as the panel keeps it, in steps of 0.01 (a number that is not a number leaves the row as it is): 0 to 1 for
 * roughness and metal, -1 to +1 for the height offset.
 */
export function setRowValue(row: MaskRow, which: 'rough' | 'metal' | 'height', value: number): MaskRow {
  if (Number.isNaN(value)) return row;
  const low = which === 'height' ? -1 : 0;
  return { ...row, [which]: Math.round(Math.min(Math.max(value, low), 1) * SLIDER_STEP) / SLIDER_STEP };
}

/** Masks R95: the row's Colour mixin, the defaults (off) for a row that has none. */
export function mixOf(row: MaskRow): RowMix {
  return row.mix ?? { ...DEFAULT_MIX };
}

const sameMix = (a: RowMix, b: RowMix): boolean => a.on === b.on && a.invert === b.invert && a.rough === b.rough && a.metal === b.metal;

/** Masks R90: one or more parts of the row's Colour mixin changed; the amounts are kept in 0 to 1 in steps of 0.01 and a number that is not a number leaves its amount as it is. */
export function setRowMix(row: MaskRow, patch: Partial<RowMix>): MaskRow {
  const current = mixOf(row);
  const amount = (value: number | undefined, kept: number): number => (value === undefined || Number.isNaN(value) ? kept : Math.round(Math.min(Math.max(value, 0), 1) * SLIDER_STEP) / SLIDER_STEP);
  return { ...row, mix: { on: patch.on ?? current.on, invert: patch.invert ?? current.invert, rough: amount(patch.rough, current.rough), metal: amount(patch.metal, current.metal) } };
}

/** Masks R94: true while any row has the Colour mixin on. */
export function hasMix(rows: readonly MaskRow[]): boolean {
  return rows.some((row) => row.mix?.on === true);
}

/** Masks R52, R86, R94: the row goes back to its matched material and that material's values, its height to 0 and its Colour mixin off with its defaults. */
export function resetRow(row: MaskRow, table: BaseMaterialTable): MaskRow {
  const chosen: MaskRow = { ...chooseMaterial({ ...row, material: row.defaultMaterial }, row.defaultMaterial, table), height: 0 };
  delete chosen.mix;
  return chosen;
}

/** Masks R52, R86, R94: true when the row already is what Reset would make it (the Reset button is disabled then). */
export function isRowAtDefaults(row: MaskRow, table: BaseMaterialTable): boolean {
  const reset = resetRow(row, table);
  return reset.material === row.material && reset.rough === row.rough && reset.metal === row.metal && reset.height === row.height && sameMix(mixOf(row), DEFAULT_MIX);
}

/** Masks R53: every row reset; rows already at their defaults are returned as they are. */
export function resetAllRows(rows: readonly MaskRow[], table: BaseMaterialTable): MaskRow[] {
  return rows.map((row) => (isRowAtDefaults(row, table) ? row : resetRow(row, table)));
}

/** Masks R82: the offsets the height bake reads, row k being label k. */
export function rowsToHeightOffsets(rows: readonly MaskRow[]): number[] {
  return rows.map(({ height }) => height);
}

/** Masks R83, R84: true while any row raises or lowers the Height map. */
export function hasHeightOffset(rows: readonly MaskRow[]): boolean {
  return rows.some(({ height }) => height !== 0);
}

/** Masks R42, R91: the look-up tables the bake reads, row k being label k; a row whose Colour mixin is on also gives its Invert and the two amounts. */
export function rowsToBake(rows: readonly MaskRow[]): BakeRow[] {
  return rows.map(({ rough, metal, mix }) => (mix?.on === true ? { rough, metal, mix: { invert: mix.invert, rough: mix.rough, metal: mix.metal } } : { rough, metal }));
}
