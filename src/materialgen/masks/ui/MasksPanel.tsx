import { useState } from 'react';
import { Button, CommitSlider } from '@shared/ui-kit';
import { isRowAtDefaults } from '../record/maskRows';
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
  onRowMaterial(label: number, name: string): void;
  /** A slider's value was released; a promise that settles when it has been stored lets the slider keep showing it until then (masks R50). */
  onRowRough(label: number, value: number): void | Promise<unknown>;
  onRowMetal(label: number, value: number): void | Promise<unknown>;
  onResetAll(): void;
  onFeather(pixels: number): void | Promise<unknown>;
}

const FEATHER_RANGE = { min: 0, max: MAX_FEATHER, step: 1, format: (value: number): string => `${value} px` };
const READ_ONLY_REASON = 'This project is open in another tab, so it cannot be changed here.';

/**
 * Masks R48-R54, R57, R59, R66-R68: the Material Masks controls of the viewport's Mask display popover, below its overlay switch and opacity slider. Top to bottom:
 * Feather, the swatch grid with the block of the selected component, a status line when one applies, then Reset all and Re-run decomposition side by side. With no
 * masks it draws nothing. It holds only which swatch is selected, and what a slider shows while it is dragged.
 */
export function MasksPanel(props: MasksPanelProps): React.JSX.Element {
  const { record, table, tableProblem, stale, canWrite, model } = props;
  const [selected, setSelected] = useState<number | null>(null);
  const locked = !canWrite;
  const changeReason = locked ? READ_ONLY_REASON : undefined;

  if (record === null) return <></>; // the masks come from the generation flow: nothing to offer before they exist

  const allAtDefaults = table === null || record.rows.every((row) => isRowAtDefaults(row, table));
  const resetAllReason = changeReason ?? (allAtDefaults ? 'Every row is at its defaults' : undefined);
  const selectedRow = record.rows.find((row) => row.label === selected); // a label the rebuilt masks no longer have selects nothing

  return (
    <div className="masks-panel">
      <CommitSlider label="Feather" layout="row" value={record.feather} onCommit={props.onFeather} disabled={locked} range={FEATHER_RANGE} />

      {table === null ? (
        <p className="masks-panel__notice" role={tableProblem === null ? 'status' : 'alert'}>{tableProblem ?? 'Loading the materials'}</p>
      ) : (
        <>
          <MaskSwatchGrid rows={record.rows} palette={record.palette} selected={selectedRow?.label ?? null} onSelect={(label) => setSelected(label === selectedRow?.label ? null : label)} />
          {selectedRow === undefined ? null : (
            <MaskRowView
              key={selectedRow.label}
              row={selectedRow}
              table={table}
              disabled={locked}
              onMaterial={(name) => props.onRowMaterial(selectedRow.label, name)}
              onRough={(value) => props.onRowRough(selectedRow.label, value)}
              onMetal={(value) => props.onRowMetal(selectedRow.label, value)}
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
