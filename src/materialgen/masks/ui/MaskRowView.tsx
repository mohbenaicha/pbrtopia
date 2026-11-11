import { useMemo } from 'react';
import { Icon, IconButton, Select, type SelectOption } from '@shared/ui-kit';
import { GENERIC, listMaterialOptions, type BaseMaterialTable } from '../table/baseMaterials';
import { isRowAtDefaults, type MaskRow } from '../record/maskRows';
import { CommitSlider } from '@shared/ui-kit';
import './masksPanel.css';

interface MaskRowViewProps {
  row: MaskRow;
  colour: string; // the row's palette colour, #RRGGBB
  table: BaseMaterialTable;
  disabled: boolean;
  /** No pixel of the labels has this label (masks R71): the row still works but changes nothing visible. */
  unused?: boolean;
  onMaterial(name: string): void;
  onRough(value: number): void | Promise<unknown>;
  onMetal(value: number): void | Promise<unknown>;
  onReset(): void;
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

/** Masks R48, R57: one component: swatch, name, base-material select, roughness and metal sliders and the row's Reset. */
export function MaskRowView({ row, colour, table, disabled, unused = false, onMaterial, onRough, onMetal, onReset }: MaskRowViewProps): React.JSX.Element {
  const options = useMemo(() => materialOptions(row, table), [row, table]);
  const atDefaults = isRowAtDefaults(row, table);
  return (
    <li className="mask-row" data-unused={unused ? '' : undefined}>
      <div className="mask-row__head">
        <span className="mask-row__swatch" data-testid={`mask-swatch-${row.label}`} style={{ backgroundColor: colour }} aria-hidden="true" />
        <span className="mask-row__name" title={row.description === '' ? undefined : row.description}>{row.name}</span>
        {unused ? <span className="mask-row__badge">Not used</span> : null}
        <IconButton label={`Reset ${row.name}`} icon={<Icon name="reset" />} compact disabled={disabled || atDefaults} {...(disabled ? {} : { disabledReason: 'Already at its defaults' })} onClick={onReset} />
      </div>
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
      <CommitSlider label={`Roughness of ${row.name}`} value={row.rough} onCommit={onRough} disabled={disabled} />
      <CommitSlider label={`Metal of ${row.name}`} value={row.metal} onCommit={onMetal} disabled={disabled} />
    </li>
  );
}
