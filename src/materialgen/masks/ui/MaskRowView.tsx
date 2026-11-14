import { useMemo } from 'react';
import { CommitSlider, Select, Toggle, Tooltip, type SelectOption } from '@shared/ui-kit';
import { findMaterial, GENERIC, listMaterialOptions, type BaseMaterialTable } from '../table/baseMaterials';
import { DEFAULT_MIX, mixOf, type MaskRow, type RowMix } from '../record/maskRows';
import { MASK_TIPS } from './maskTooltips';
import './masksPanel.css';

interface MaskRowViewProps {
  row: MaskRow;
  /** How many other components are selected with this one (masks R89); a change sets them all. */
  others?: number;
  table: BaseMaterialTable;
  disabled: boolean;
  onMaterial(name: string): void;
  onRough(value: number): void | Promise<unknown>;
  onMetal(value: number): void | Promise<unknown>;
  onHeight(value: number): void | Promise<unknown>;
  /** Why the Height slider is off (no Height map, masks R81), or null while it works. */
  heightDisabledReason: string | null;
  /** A change of the Colour mixin: the switch, Invert or a released amount (masks R90). */
  onMix(patch: Partial<RowMix>): void | Promise<unknown>;
  /** Why the Colour mixin switch is off (no albedo map, masks R90), or null while it works. */
  mixDisabledReason: string | null;
}

const HEIGHT_RANGE = { min: -1, max: 1, step: 0.01, format: (value: number): string => `${value < 0 ? '-' : '+'}${Math.abs(value).toFixed(2)}` };

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
 * Masks R48, R57, R81: one component's block: its name, the base-material select under it, then the Roughness and Metalness sliders with their value and reset arrow,
 * and the Height slider (-1 to +1, its arrow goes back to 0). A slider's reset arrow puts it back to the value of the row's chosen base material; a material that is
 * not in the table leaves the arrow with nothing to go back to.
 */
export function MaskRowView({ row, others = 0, table, disabled, onMaterial, onRough, onMetal, onHeight, heightDisabledReason, onMix, mixDisabledReason }: MaskRowViewProps): React.JSX.Element {
  const options = useMemo(() => materialOptions(row, table), [row, table]);
  const chosen = findMaterial(table, row.material);
  const mix = mixOf(row);
  const heightRow = (
    <div className="mask-row__height" style={{ minWidth: 0 }} data-blocked={heightDisabledReason === null ? undefined : ''}>
      <CommitSlider label="Height" hint={MASK_TIPS.height} layout="row" value={row.height} onCommit={onHeight} disabled={disabled || heightDisabledReason !== null} resetTo={0} range={HEIGHT_RANGE} />
    </div>
  );
  return (
    <div className="mask-row" role="group" aria-label={row.name}>
      <Tooltip heading={row.name} text={row.description}>
        <span className="mask-row__name">{others > 0 ? `${row.name} +${others}` : row.name}</span>
      </Tooltip>
      <Select
        label={`Base material of ${row.name}`}
        hideLabel
        options={options}
        value={row.material}
        onChange={onMaterial}
        disabled={disabled}
        searchable
        noMatchText="No material matches"
        title={MASK_TIPS.material}
      />
      <CommitSlider label="Roughness" hint={MASK_TIPS.roughness} layout="row" value={row.rough} onCommit={onRough} disabled={disabled} resetTo={chosen?.roughness ?? row.rough} />
      <CommitSlider label="Metalness" hint={MASK_TIPS.metalness} layout="row" value={row.metal} onCommit={onMetal} disabled={disabled} resetTo={chosen?.metal ?? row.metal} />
      {heightDisabledReason === null ? heightRow : <Tooltip heading="Height" text={heightDisabledReason}>{heightRow}</Tooltip>}
      <Toggle label="Colour mixin" checked={mix.on} onChange={(on) => onMix({ on })} disabled={disabled || mixDisabledReason !== null} hint={mixDisabledReason ?? 'Shapes roughness and metalness by the albedo inside this component'} />
      {mix.on && (
        <div className="mask-row__mixin" role="group" aria-label="Colour mixin">
          <Toggle label="Invert" hint={MASK_TIPS.mixinInvert} checked={mix.invert} onChange={(invert) => onMix({ invert })} disabled={disabled} />
          <CommitSlider label="Roughness" hint={MASK_TIPS.mixinRoughness} layout="row" value={mix.rough} onCommit={(rough) => onMix({ rough })} disabled={disabled} resetTo={DEFAULT_MIX.rough} />
          <CommitSlider label="Metalness" hint={MASK_TIPS.mixinMetalness} layout="row" value={mix.metal} onCommit={(metal) => onMix({ metal })} disabled={disabled} resetTo={DEFAULT_MIX.metal} />
        </div>
      )}
    </div>
  );
}
