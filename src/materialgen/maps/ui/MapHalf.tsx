import { useId, useRef } from 'react';
import { Icon, IconButton, Tooltip } from '@shared/ui-kit';
import type { MapKind } from '../mapKinds';
import { MapThumbnail, type DrawThumbnail } from './MapThumbnail';
import type { CardModel, HalfModel } from './buildCardModel';
import { useDropZone } from './useDropZone';
import { MAP_TIPS } from './mapTooltips';

export interface MapCardActions {
  dropFiles(kind: MapKind, files: File[]): void;
  undo(kinds: MapKind[]): void;
  restoreOriginal(kind: MapKind): void;
  requestClear(kind: MapKind): void;
  view(kind: MapKind): void;
  /** Opens the filter dialog for the map (imageops R17). */
  filter(kind: MapKind): void;
  download(kind: MapKind): void;
  /** Tells the person why a drop was not taken (a drop on the card outside both halves of a two-map card). */
  refuseDrop(message: string): void;
}

export interface HalfContext {
  canWrite: boolean;
  readOnlyReason: string;
  busy: boolean;
  /** True while an op session is open: every other op button is disabled (imageops R9). */
  opOpen?: boolean;
  readBlob(key: string): Promise<Blob | null>;
  draw?: DrawThumbnail;
  actions: MapCardActions;
}

interface MapHalfProps extends HalfContext {
  half: HalfModel;
  /** Present when this half carries the card's Undo button (a card with one map). */
  undo?: CardModel['undo'];
  /** Buttons the host adds to the overlay (the AO tool on the AO map). */
  extras?: React.ReactNode;
}

/** One map of a card: its drop zone with the thumbnail, what it is, and its buttons (maps R34, R44, R45). */
export function MapHalf({ half, undo, extras, canWrite, readOnlyReason, busy, opOpen = false, readBlob, draw, actions }: MapHalfProps): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const { dragging, zoneProps } = useDropZone((files) => actions.dropFiles(half.kind, files));
  const reasonFor = (needsMap: boolean): string | undefined => {
    if (!canWrite) return readOnlyReason;
    if (busy) return 'This map is being changed.';
    return needsMap && !half.filled ? `There is no ${half.label} map yet.` : undefined;
  };
  const viewReason = half.filled ? undefined : `There is no ${half.label} map yet.`;
  const captionText = [half.label, half.sizeText].filter((part) => part !== null).join(' '); // "Albedo 1024 x 1024", as the projection app's captions
  const captionWords = [half.sizeText, half.sourceText, half.stale ? 'The map this one was computed from has changed.' : null].filter((part) => part !== null).join(' · ');
  const writeReason = reasonFor(true);
  const chooseReason = !canWrite ? readOnlyReason : busy ? 'This map is being changed.' : undefined;
  const downloadReason = viewReason ?? (busy ? 'This map is being changed.' : undefined); // a download that races a commit could read a file just deleted
  const restoreReason = writeReason ?? (half.canRestore ? undefined : 'The working map is already the original.');
  const filterReason = writeReason ?? (opOpen ? 'Another edit is open. Apply or cancel it first.' : undefined);
  const label = (verb: string): string => `${verb} ${half.label}`;

  const drop = (
        <div className="map-half__drop" data-dragging={dragging ? '' : undefined} aria-busy={busy || undefined} {...zoneProps}>
          {half.filled && half.workingKey !== null ? (
            <button type="button" className="map-half__picture" aria-label={label('View')} onClick={() => actions.view(half.kind)}>
              <MapThumbnail label={half.label} blobKey={half.workingKey} readBlob={readBlob} {...(draw ? { draw } : {})} />
            </button>
          ) : (
            <>
              <button
                type="button"
                className="map-half__picture map-half__choose"
                aria-label="Choose image"
                disabled={!canWrite || busy}
                onClick={() => input.current?.click()}
              >
                <span>Drop an image here or click to choose one</span>
              </button>
              <input
                ref={input}
                id={inputId}
                className="map-half__file"
                type="file"
                accept="image/*"
                aria-label={label('Choose image for')}
                tabIndex={-1}
                onChange={(event) => {
                  actions.dropFiles(half.kind, Array.from(event.target.files ?? []));
                  event.target.value = '';
                }}
              />
            </>
          )}
        </div>
  );

  return (
    <div className="map-half" data-testid="map-half" data-kind={half.kind}>
      <div className="map-half__frame" data-filled={half.filled ? '' : undefined}>
        {!half.filled && chooseReason !== undefined ? <Tooltip heading="Choose image" text={chooseReason}>{drop}</Tooltip> : drop}
        <Tooltip heading={half.label} text={captionWords}>
          <p className="map-half__caption" data-testid="map-caption">
            {captionText}
            {half.stale && <span className="map-half__stale"> Stale, regenerate</span>}
          </p>
        </Tooltip>
        {(half.filled || extras) && (
          <div className="map-half__buttons">
            {half.filled && (
              <>
            <IconButton label={label('Filter')} hint={MAP_TIPS.filter} icon={<Icon name="pencil" size={16} />} disabled={filterReason !== undefined} {...(filterReason ? { disabledReason: filterReason } : {})} onClick={() => actions.filter(half.kind)} />
            <IconButton label={label('Restore original')} hint={MAP_TIPS.restoreOriginal} icon={<Icon name="reset" size={16} />} disabled={restoreReason !== undefined} {...(restoreReason ? { disabledReason: restoreReason } : {})} onClick={() => actions.restoreOriginal(half.kind)} />
            {undo && <UndoButton undo={undo} canWrite={canWrite} readOnlyReason={readOnlyReason} busy={busy} actions={actions} />}
            <IconButton label={label('Download')} hint={MAP_TIPS.download} icon={<Icon name="download" size={16} />} disabled={downloadReason !== undefined} {...(downloadReason ? { disabledReason: downloadReason } : {})} onClick={() => actions.download(half.kind)} />
            <IconButton label={label('Clear')} hint={MAP_TIPS.clear} icon={<Icon name="trash" size={16} />} disabled={writeReason !== undefined} {...(writeReason ? { disabledReason: writeReason } : {})} onClick={() => actions.requestClear(half.kind)} />
              </>
            )}
            {extras}
          </div>
        )}
      </div>
    </div>
  );
}

interface UndoButtonProps {
  undo: CardModel['undo'];
  canWrite: boolean;
  readOnlyReason: string;
  busy: boolean;
  actions: MapCardActions;
}

/** The card's one Undo (maps R47): its tooltip names the label and the maps it changes. */
export function UndoButton({ undo, canWrite, readOnlyReason, busy, actions }: UndoButtonProps): React.JSX.Element {
  const reason = !canWrite ? readOnlyReason : busy ? 'This map is being changed.' : undo.enabled ? undefined : undo.tooltip;
  return (
    <IconButton
      label={undo.enabled ? undo.tooltip : 'Undo'}
      icon={<Icon name="undo" size={16} />}
      disabled={reason !== undefined}
      {...(reason ? { disabledReason: reason } : {})}
      onClick={() => actions.undo(undo.kinds)}
    />
  );
}
