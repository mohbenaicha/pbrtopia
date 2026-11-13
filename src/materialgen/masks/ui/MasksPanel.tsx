import { useEffect, useState } from 'react';
import { Button, CommitSlider } from '@shared/ui-kit';
import { isRowAtDefaults, type RowMix } from '../record/maskRows';
import type { MasksRecord } from '../record/masksRecord';
import type { BaseMaterialTable } from '../table/baseMaterials';
import { MAX_FEATHER } from '../bake/bakeMasks';
import { MaskRowView } from './MaskRowView';
import { MaskSwatchGrid } from './MaskSwatchGrid';
import { ModelRunNotice, RerunDecompositionButton } from './ModelRunParts';
import './masksPanel.css';

/** Masks R64-R68: the model path as the panel sees it; the app binds it to a run of the describe step and the decomposition image. */
export interface MasksModelControls {
  /** Why the model actions are off (no vision-text model, no key, no decomposition model), shown as their tooltip; null when they are available. */
  disabledReason: string | null;
  running: boolean;
  /** The failed step, named, or null (R67). */
  error: string | null;
  canRetry: boolean;
  /** The models a re-run uses, for its question (R66). */
  modelNames: string;
  onCreate(): void;
  onRerun(): void;
  onCancel(): void;
  onRetry(): void;
}

/** The components a change applies to: one label, or the selected ones (masks R89). */
export type RowLabels = number | readonly number[];

export interface MasksPanelProps {
  /** The stored masks, or null when the material has none. */
  record: MasksRecord | null;
  /** The base materials, or null while they are not loaded (then `tableProblem` says why when loading failed). */
  table: BaseMaterialTable | null;
  tableProblem: string | null;
  /** The albedo is not the one the labels were made from (masks R59). */
  stale: boolean;
  canWrite: boolean;
  model: MasksModelControls;
  /** The row changes name every selected component (`labels`: one label or the selected ones in label order; masks R89). */
  onRowMaterial(labels: RowLabels, name: string): void;
  /** A slider's value was released; a promise that settles when it has been stored lets the slider keep showing it until then (masks R50). */
  onRowRough(labels: RowLabels, value: number): void | Promise<unknown>;
  onRowMetal(labels: RowLabels, value: number): void | Promise<unknown>;
  /** The Height offset of the rows, -1 to +1 (masks R81). */
  onRowHeight(labels: RowLabels, value: number): void | Promise<unknown>;
  /** The Height slot has a working map; without one the Height sliders are off (masks R81). */
  hasHeightMap: boolean;
  /** The Colour mixin of the rows changed: the switch, Invert or a released amount (masks R90). */
  onRowMix(labels: RowLabels, patch: Partial<RowMix>): void | Promise<unknown>;
  /** The material has an albedo (or diffuse) map to mix from; without one the Colour mixin switch is off (masks R90). */
  hasAlbedo: boolean;
  onResetAll(): void;
  onFeather(pixels: number): void | Promise<unknown>;
  /** The swatch under the pointer or holding the focus (masks R80), or null; the preview draws that component alone. */
  onHighlight?(label: number | null): void;
}

const FEATHER_RANGE = { min: 0, max: MAX_FEATHER, step: 1, format: (value: number): string => `${value} px` };
const NO_HEIGHT_REASON = 'Add a height map first';
const NO_ALBEDO_REASON = 'No albedo map';
const READ_ONLY_REASON = 'This project is open in another tab, so it cannot be changed here.';

/**
 * Masks R48-R54, R57, R59, R66-R68: the Material Masks controls of the viewport's Mask display popover, below its overlay switch and opacity slider. Top to bottom:
 * Feather, the swatch grid with the block of the selected component, a status line when one applies, then Reset all and Re-run decomposition side by side. With no
 * masks it draws nothing. It holds only which swatch is selected, and what a slider shows while it is dragged.
 */
export function MasksPanel(props: MasksPanelProps): React.JSX.Element {
  const { record, table, tableProblem, stale, canWrite, model } = props;
  const [selected, setSelected] = useState<readonly number[]>([]); // the clicked labels in click order (masks R89); the last one is the one the block shows
  const { onHighlight } = props;
  useEffect(() => () => onHighlight?.(null), [onHighlight]); // R80: a panel that goes (popover closed, masks gone) leaves no highlight behind
  const locked = !canWrite;
  const changeReason = locked ? READ_ONLY_REASON : undefined;

  if (record === null) return <></>; // the masks come from the generation flow: nothing to offer before they exist

  const allAtDefaults = table === null || record.rows.every((row) => isRowAtDefaults(row, table));
  const resetAllReason = changeReason ?? (allAtDefaults ? 'Every row is at its defaults' : undefined);
  const chosen = selected.filter((label) => record.rows.some((row) => row.label === label)); // a label the rebuilt masks no longer have selects nothing
  const selectedRow = record.rows.find((row) => row.label === chosen[chosen.length - 1]);
  const labels = record.rows.map((row) => row.label).filter((label) => chosen.includes(label)); // R89: what a change sets, in label order
  const toggle = (label: number): void => setSelected(chosen.includes(label) ? chosen.filter((other) => other !== label) : [...chosen, label]);

  return (
    <div className="masks-panel">
      <CommitSlider label="Feather" layout="row" value={record.feather} onCommit={props.onFeather} disabled={locked} range={FEATHER_RANGE} />

      {table === null ? (
        <p className="masks-panel__notice" role={tableProblem === null ? 'status' : 'alert'}>{tableProblem ?? 'Loading the materials'}</p>
      ) : (
        <>
          <MaskSwatchGrid rows={record.rows} palette={record.palette} selected={chosen} {...(onHighlight === undefined ? {} : { onHighlight })} onSelect={toggle} />
          {selectedRow === undefined ? null : (
            <MaskRowView
              key={selectedRow.label}
              row={selectedRow}
              others={labels.length - 1}
              table={table}
              disabled={locked}
              onMaterial={(name) => props.onRowMaterial(labels, name)}
              onRough={(value) => props.onRowRough(labels, value)}
              onMetal={(value) => props.onRowMetal(labels, value)}
              onHeight={(value) => props.onRowHeight(labels, value)}
              heightDisabledReason={props.hasHeightMap ? null : NO_HEIGHT_REASON}
              onMix={(patch) => props.onRowMix(labels, patch)}
              mixDisabledReason={props.hasAlbedo ? null : NO_ALBEDO_REASON}
            />
          )}
        </>
      )}

      {stale ? <p className="masks-panel__notice" role="status">Albedo changed since the masks were made</p> : null}
      <ModelRunNotice model={model} locked={locked} />
      <div className="masks-panel__buttons">
        <Button disabled={locked || allAtDefaults} {...(resetAllReason === undefined ? {} : { title: resetAllReason })} onClick={props.onResetAll}>Reset all</Button>
        <RerunDecompositionButton model={model} locked={locked} lockedReason={changeReason} />
      </div>
    </div>
  );
}
