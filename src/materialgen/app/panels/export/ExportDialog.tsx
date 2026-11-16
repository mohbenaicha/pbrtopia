import { Button, Dialog, Select, SegmentedControl, Toggle, Tooltip } from '@shared/ui-kit';
import { EXPORT_TARGET_CARDS, type ExportDialogTarget, type ExportKind } from '@mat/export';
import { TARGET_LOGO_URLS } from '../../addons/addonFiles';
import { EmissiveDialog } from './EmissiveDialog';
import type { useExportDialog } from './useExportDialog';
import './exportDialog.css';

export type ExportDialogState = ReturnType<typeof useExportDialog>;

const KIND_NAMES: Record<ExportKind, string> = { albedo: 'Albedo', normal: 'Normal', height: 'Height', roughness: 'Roughness', metallic: 'Metallic', ao: 'Ambient occlusion', orm: 'Packed ORM', labels: 'Labels', masks: 'Masks', emissive: 'Emissive' };

function TargetCards({ dialog }: { dialog: ExportDialogState }): React.JSX.Element {
  const { options, setOptions, cardFiles, running } = dialog;
  return (
    <div className="export-dialog__cards" role="radiogroup" aria-label="Export for" data-tutorial="export-types">
      {EXPORT_TARGET_CARDS.map((card) => {
        const selected = options.target === card.target;
        return (
          <label key={card.target} className="export-dialog__card" data-selected={selected ? '' : undefined}>
            <input type="radio" name="export-target" value={card.target} checked={selected} disabled={running} onChange={() => setOptions({ target: card.target as ExportDialogTarget })} />
            <img className="export-dialog__card-logo" src={TARGET_LOGO_URLS[card.target]} alt="" />
            <Tooltip heading={card.title} text={`Names and arranges the exported files the way ${card.title} expects.`}><span className="export-dialog__card-title">{card.title}</span></Tooltip>
            <span className="export-dialog__card-convention">{card.convention}</span>
            {selected && (
              <span className="export-dialog__card-details">
                <span>{card.instructions}</span>
                <span className="export-dialog__card-files">{cardFiles[card.target].join(', ')}</span>
              </span>
            )}
          </label>
        );
      })}
    </div>
  );
}

function OptionRows({ dialog }: { dialog: ExportDialogState }): React.JSX.Element {
  const { options, setOptions, disabled, sizeChoices, running, emissive, tiling } = dialog;
  return (
    <div className="export-dialog__options">
      <div className="export-dialog__group" data-tutorial="export-options">
        <SegmentedControl
          label="Packing"
          hint="Separate writes one file per map; Packed ORM puts occlusion, roughness and metalness in one file."
          options={[{ value: 'separate', label: 'Separate' }, { value: 'packed', label: 'Packed ORM' }]}
          value={options.packing}
          onChange={(packing) => setOptions({ packing })}
          disabled={running}
        />
      </div>
      <div className="export-dialog__group" data-tutorial="export-parts">
      <Toggle label="Include height" checked={options.includeHeight && !disabled.includeHeight} disabled={running || disabled.includeHeight} hint={disabled.includeHeight ? 'There is no height map.' : 'Adds the height map to the export.'} onChange={(includeHeight) => setOptions({ includeHeight })} />
      <Toggle label="Include ambient occlusion" checked={options.includeAo && !disabled.includeAo} disabled={running || disabled.includeAo} hint={disabled.includeAo ? 'There is no ambient occlusion map.' : 'Adds the ambient occlusion map to the export.'} onChange={(includeAo) => setOptions({ includeAo })} />
      <Toggle label="Include material masks" checked={options.includeMasks && !disabled.includeMasks} disabled={running || disabled.includeMasks} hint={disabled.includeMasks ? 'There are no material masks.' : 'Adds the mask image and its component table to the export.'} onChange={(includeMasks) => setOptions({ includeMasks })} />
      <Toggle label="Create emissive map" checked={emissive.plane !== null} disabled={running || disabled.includeEmissive} hint={disabled.includeEmissive ? 'There are no material masks.' : 'Pick the materials that glow and add an emissive map to the export.'} onChange={(on) => (on ? emissive.ask() : emissive.drop())} />
      <Toggle label="Export tiling (change in tiling settings)" checked={tiling.checked} disabled={running || tiling.blockReason !== null} hint={tiling.hint} onChange={tiling.set} />
      </div>
      <div className="export-dialog__group" data-tutorial="export-size">
        <Select label="Size" title="The side length of every exported map, in pixels." options={sizeChoices.map((side) => ({ value: String(side), label: `${side} px` }))} value={String(options.size)} onChange={(value) => setOptions({ size: Number(value) })} disabled={running || sizeChoices.length < 2} />
      </div>
    </div>
  );
}

function FileList({ dialog }: { dialog: ExportDialogState }): React.JSX.Element {
  const { plan } = dialog;
  return (
    <div className="export-dialog__files">
      {plan.warnings.map((warning) => <p key={warning} className="export-dialog__warning" role="status">{warning}</p>)}
      <ul aria-label="Files">
        {plan.files.map((file) => (
          <li key={file.fileName}>
            <span className="export-dialog__file-name">{file.fileName}</span>
            <span className="export-dialog__file-size">{file.sizePx === null ? '' : file.widthPx === file.heightPx ? `${file.sizePx} px` : `${file.widthPx} x ${file.heightPx} px`}</span>
            {plan.stale.includes(file.kind) && <span className="export-dialog__stale">Out of date. Regenerate it first for a matching result</span>}
          </li>
        ))}
        {plan.missing.map((kind) => (
          <li key={kind} className="export-dialog__missing"><span className="export-dialog__file-name">{KIND_NAMES[kind]}</span><span>Not generated</span></li>
        ))}
      </ul>
      {plan.files.length === 0 && <p className="export-dialog__empty">There is nothing to export yet.</p>}
    </div>
  );
}

/** Export R20-R22, R27, R28, R33, R34, R36: the export dialog. All state lives in `useExportDialog`; this draws it. */
export function ExportDialog({ dialog }: { dialog: ExportDialogState }): React.JSX.Element | null {
  const { open, close, running, progress, error, phase, canExport, start, cancel, emissive } = dialog;
  return (
    <Dialog
      open={open}
      title="Export material"
      onClose={running ? cancel : close}
      closeOnOutsideClick={!running}
      actions={
        <>
          <Button variant="ghost" onClick={running ? cancel : close}>{running ? 'Cancel export' : 'Cancel'}</Button>
          <Button variant="primary" loading={running} disabled={!canExport} onClick={() => void start()}>{phase === 'failed' ? 'Try again' : 'Export'}</Button>
        </>
      }
    >
      <div className="export-dialog">
        <TargetCards dialog={dialog} />
        <OptionRows dialog={dialog} />
        <FileList dialog={dialog} />
        {progress !== null && (
          <div className="export-dialog__progress" role="status">
            <progress max={progress.total} value={progress.done} aria-label="Export progress" />
            <span>{progress.label}</span>
          </div>
        )}
        {error !== null && <p className="export-dialog__error" role="alert">{error}</p>}
      </div>
      {emissive.asking && emissive.source.labelsKey !== null && (
        <EmissiveDialog {...emissive.source} labelsKey={emissive.source.labelsKey} onConfirm={emissive.confirm} onCancel={emissive.cancelAsk} />
      )}
    </Dialog>
  );
}
