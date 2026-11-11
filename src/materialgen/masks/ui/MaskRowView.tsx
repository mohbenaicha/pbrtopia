import { useMemo } from 'react';
import { CommitSlider, Select, type SelectOption } from '@shared/ui-kit';
import { findMaterial, GENERIC, listMaterialOptions, type BaseMaterialTable } from '../table/baseMaterials';
import type { MaskRow } from '../record/maskRows';
import './masksPanel.css';

interface MaskRowViewProps {
  row: MaskRow;
  table: BaseMaterialTable;
  disabled: boolean;
  onMaterial(name: string): void;
  onRough(value: number): void | Promise<unknown>;
  onMetal(value: number): void | Promise<unknown>;
}

/** Select options for a row: its suggestions first, then Generic, then every name once (masks R37). */
function materialOptions(row: MaskRow, table: BaseMaterialTable): SelectOption[] {
  const seen = new Set<string>();
  const options: SelectOption[] = [];
  const add = (name: string, group: string, values?: { roughness: number; metal: number }): void => {
    if (seen.has(name)) return;
    seen.add(name);
    options.push({ value: name, label: name, group, ...(values === undefined ? {} : { detail: `${values.roughness.toFixed(2)} / ${values.metal.toFixed(2)}` }) });
  };
  for (const option of listMaterialOptions(table, row.top3, '')) add(option.name, option.suggested ? 'Suggested' : 'All materials', option);
  if (!seen.has(row.material)) add(row.material, 'All materials', { roughness: row.rough, metal: row.metal }); // a record made with another table still shows what it uses
  if (!seen.has(GENERIC.name)) add(GENERIC.name, 'All materials', GENERIC);
  return options;
}

/**
 * Masks R48, R57: one component's block: its name, the base-material select under it, then the Roughness and Metalness sliders with their value and reset arrow.
 * A slider's reset arrow puts it back to the value of the row's chosen base material; a material that is not in the table leaves the arrow with nothing to go back to.
 */
export function MaskRowView({ row, table, disabled, onMaterial, onRough, onMetal }: MaskRowViewProps): React.JSX.Element {
  const options = useMemo(() => materialOptions(row, table), [row, table]);
  const chosen = findMaterial(table, row.material);
  return (
    <div className="mask-row" role="group" aria-label={row.name}>
      <span className="mask-row__name" title={row.description === '' ? undefined : row.description}>{row.name}</span>
      <Select
        label={`Base material of ${row.name}`}
        hideLabel
        options={options}
        value={row.material}
        onChange={onMaterial}
        disabled={disabled}
        searchable
        noMatchText="No material matches"
        title="Estimated default"
      />
      <CommitSlider label="Roughness" layout="row" value={row.rough} onCommit={onRough} disabled={disabled} resetTo={chosen?.roughness ?? row.rough} />
      <CommitSlider label="Metalness" layout="row" value={row.metal} onCommit={onMetal} disabled={disabled} resetTo={chosen?.metal ?? row.metal} />
    </div>
  );
}
