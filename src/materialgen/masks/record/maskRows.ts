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
}

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
  };
}

/** Masks R40: another base material replaces the row's roughness and metal with its own; the matched default is kept for Reset. */
export function chooseMaterial(row: MaskRow, name: string, table: BaseMaterialTable): MaskRow {
  const material = findMaterial(table, name);
  return material === undefined ? row : { ...row, material: material.name, rough: material.roughness, metal: material.metal };
}

/** Masks R50: a slider value as the panel keeps it, from 0 to 1 in steps of 0.01 (a number that is not a number leaves the row as it is). */
export function setRowValue(row: MaskRow, which: 'rough' | 'metal', value: number): MaskRow {
  if (Number.isNaN(value)) return row;
  return { ...row, [which]: Math.round(Math.min(Math.max(value, 0), 1) * SLIDER_STEP) / SLIDER_STEP };
}

/** Masks R52: the row goes back to its matched material and that material's values. */
export function resetRow(row: MaskRow, table: BaseMaterialTable): MaskRow {
  return chooseMaterial({ ...row, material: row.defaultMaterial }, row.defaultMaterial, table);
}

/** Masks R52: true when the row already is what Reset would make it (the Reset button is disabled then). */
export function isRowAtDefaults(row: MaskRow, table: BaseMaterialTable): boolean {
  const reset = resetRow(row, table);
  return reset.material === row.material && reset.rough === row.rough && reset.metal === row.metal;
}

/** Masks R53: every row reset; rows already at their defaults are returned as they are. */
export function resetAllRows(rows: readonly MaskRow[], table: BaseMaterialTable): MaskRow[] {
  return rows.map((row) => (isRowAtDefaults(row, table) ? row : resetRow(row, table)));
}

/** Masks R42: the look-up tables the bake reads, row k being label k. */
export function rowsToBake(rows: readonly MaskRow[]): BakeRow[] {
  return rows.map(({ rough, metal }) => ({ rough, metal }));
}
