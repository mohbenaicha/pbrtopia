import { Button, Toggle } from '@shared/ui-kit';
import { isRowAtDefaults } from '../record/maskRows';
import type { MasksRecord } from '../record/masksRecord';
import type { BaseMaterialTable } from '../table/baseMaterials';
import { MAX_FEATHER } from '../bake/bakeMasks';
import { CommitSlider } from '@shared/ui-kit';
import { MaskRowView } from './MaskRowView';
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
  /** A masks operation is running: every change waits. */
  busy: boolean;
  /** Labels with no pixel (masks R71). */
  unusedLabels: ReadonlySet<number>;
  overlay: boolean;
  model: MasksModelControls;
  onRowMaterial(label: number, name: string): void;
  /** A slider's value was released; a promise that settles when it has been stored lets the slider keep showing it until then (masks R50). */
  onRowRough(label: number, value: number): void | Promise<unknown>;
  onRowMetal(label: number, value: number): void | Promise<unknown>;
  onResetRow(label: number): void;
  onResetAll(): void;
  onFeather(pixels: number): void | Promise<unknown>;
  onOverlay(on: boolean): void;
  onRequantise(): void;
}

const FEATHER_RANGE = { min: 0, max: MAX_FEATHER, step: 1, format: (value: number): string => `${value} px` };
const READ_ONLY_REASON = 'This project is open in another tab, so it cannot be changed here.';
const BUSY_REASON = 'The masks are being built.';
const titled = (reason: string | undefined): { title?: string } => (reason === undefined ? {} : { title: reason });

/**
 * Masks R48-R57, R59, R71: the Material Masks panel. With no masks it offers the two ways to make them; with masks it lists one row per
 * component and the controls around them. It holds no state of its own beyond what a slider shows while it is dragged.
 */
export function MasksPanel(props: MasksPanelProps): React.JSX.Element {
  const { record, table, tableProblem, stale, canWrite, busy, unusedLabels, overlay, model } = props;
  const changeReason = !canWrite ? READ_ONLY_REASON : busy ? BUSY_REASON : undefined;
  const locked = changeReason !== undefined;

  if (record === null) return <></>; // the masks come from the generation flow: nothing to offer before they exist

  const colourOf = (label: number): string => record.palette.find((entry) => entry.label === label)?.hex ?? 'transparent';
  const allAtDefaults = table === null || record.rows.every((row) => isRowAtDefaults(row, table));

  return (
    <div className="masks-panel">
      {stale ? (
        <div className="masks-panel__notice" role="status">
          <p>Albedo changed since the masks were made</p>
          <div className="masks-panel__actions">
            <RerunDecompositionButton model={model} locked={locked} lockedReason={changeReason} />
          </div>
        </div>
      ) : null}

      <div className="masks-panel__actions">
        <RerunDecompositionButton model={model} locked={locked} lockedReason={changeReason} />
        <Button disabled={locked || model.running} {...titled(changeReason)} onClick={props.onRequantise}>Re-quantise</Button>
      </div>
      <ModelRunNotice model={model} locked={locked} />
      <Toggle label="Overlay" checked={overlay} onChange={props.onOverlay} />
      <CommitSlider label="Feather" value={record.feather} onCommit={props.onFeather} disabled={locked} range={FEATHER_RANGE} />

      {table === null ? (
        <p className="masks-panel__notice" role={tableProblem === null ? 'status' : 'alert'}>{tableProblem ?? 'Loading the materials'}</p>
      ) : (
        <>
          <ul className="mask-rows" aria-label="Components">
            {record.rows.map((row) => (
              <MaskRowView
                key={row.label}
                row={row}
                colour={colourOf(row.label)}
                table={table}
                disabled={locked}
                unused={unusedLabels.has(row.label)}
                onMaterial={(name) => props.onRowMaterial(row.label, name)}
                onRough={(value) => props.onRowRough(row.label, value)}
                onMetal={(value) => props.onRowMetal(row.label, value)}
                onReset={() => props.onResetRow(row.label)}
              />
            ))}
          </ul>
          <Button disabled={locked || allAtDefaults} {...titled(changeReason ?? (allAtDefaults ? 'Every row is at its defaults' : undefined))} onClick={props.onResetAll}>Reset all</Button>
        </>
      )}
    </div>
  );
}
