import { useMemo, useRef, useState } from 'react';
import type { Provider } from '../../../keys';
import { Button, Icon, useDismiss } from '../../../ui-kit';
import { addSheet, applySettingsToAll, assignCamera, describePlanProblem, removeSheet, reorderSheets, setAuxIncluded, unassignCamera, updateSheetSettings } from '../../custom/planEditing';
import { CORE_CAMERA_NAMES, MAX_CORE_SHEETS, type CustomPlanRecord, type NamedPlanRecord, type SheetSettings } from '../../custom/planTypes';
import type { SheetPreview, SnapshotTrim } from '../../custom/sheetPreview';
import { buildPresetPlan, buildPresetSettings, detectPreset, pickPresetModel, type PresetName } from '../../custom/presets';
import { describeSheetProblem } from '../../generateAvailability';
import type { ModelCatalog } from '../../generateStore';
import { AuxSheetCard } from './AuxSheetCard';
import { clearDropHint, hasLeftTarget, markDragSource, showDropEdge, showDropHint } from './dragFeedback';
import { SetupToolbar } from './SetupToolbar';
import { SheetCard } from './SheetCard';
import { SnapshotRow } from './SnapshotRow';
import './SetupOverlay.css';

export interface SetupOverlayProps {
  activePlan: CustomPlanRecord | null; // the confirmed plan the overlay opens on; null before the first Confirm
  snapshots: Blob[] | null; // six, in core order; null while they are taken (R3)
  trims: SnapshotTrim[] | null; // each core camera's silhouette box, to cut the snapshots to (R3); null until measured
  previewsOf: (plan: CustomPlanRecord) => (SheetPreview | null)[]; // the canvas and tile placement of each sheet in plan order, the aux sheet last (R5)
  catalog: ModelCatalog;
  hasKey: Record<Provider, boolean>;
  maxTextureSize: number;
  today: string;
  savedSetups: NamedPlanRecord[];
  onConfirm: (plan: CustomPlanRecord) => void;
  onCancel: () => void;
  onSaveSetup: (name: string, plan: CustomPlanRecord) => void;
  onDeleteSetup: (name: string) => void;
}

type Dragged = { kind: 'camera'; camera: number } | { kind: 'sheet'; index: number };

const PRESETS: readonly { name: PresetName; label: string }[] = [
  { name: 'default', label: 'Default: 4 images + auxiliary' },
  { name: 'two-two-two', label: '2-2-2: 3 images of 2 views + auxiliary' },
  { name: 'three-images', label: '3-3: 2 images of 3 views + auxiliary' },
];

const ROW_TARGET = -1; // the snapshot row, before the first card

const FALLBACK_SETTINGS: SheetSettings = { provider: 'openai', modelId: '', resolutionKey: '1K', quality: null };

/**
 * Custom R2-R8: the setup overlay over the viewport area. Edits a copy of the plan; Confirm hands it over, Cancel (also Escape) drops it; a pointer press outside does nothing.
 * A camera is moved by drag and drop, or by the keyboard path: pick a snapshot up, steer with the arrows, drop with Space (R8), or use "Add ... to image N" on a card (or "Unassign ...").
 */
export function SetupOverlay({ activePlan, snapshots, trims, previewsOf, catalog, hasKey, maxTextureSize, today, savedSetups, onConfirm, onCancel, onSaveSetup, onDeleteSetup }: SetupOverlayProps): React.JSX.Element {
  const presetModel = pickPresetModel(catalog, hasKey);
  const [plan, setPlan] = useState<CustomPlanRecord>(() => activePlan ?? (presetModel === null ? { sheets: [], aux: null } : buildPresetPlan('default', presetModel)));
  const [picked, setPicked] = useState<number | null>(null);
  const [target, setTarget] = useState(ROW_TARGET); // custom R8: where the picked camera would be dropped: a card index, or the row
  const [announcement, setAnnouncement] = useState('');
  const [syncSettings, setSyncSettings] = useState(true); // R5: on at first
  const dragged = useRef<Dragged | null>(null);
  const swallowSpaceRelease = useRef(false);
  const panel = useRef<HTMLDivElement>(null);
  const defaults = presetModel === null ? FALLBACK_SETTINGS : buildPresetSettings(presetModel);

  useDismiss(true, panel, () => {
    if (panel.current?.querySelector('[role="dialog"]')) return; // the replace question is open: it takes Escape
    if (picked === null) onCancel();
    else putDown();
  }, false);

  const edit = (next: CustomPlanRecord, message?: string): void => {
    setPlan(next);
    if (message !== undefined) setAnnouncement(message);
  };
  const putDown = (): void => {
    setPicked(null);
    setAnnouncement('');
  };
  const nameOf = (camera: number): string => CORE_CAMERA_NAMES[camera] ?? `Camera ${camera}`;

  const problem = describePlanProblem(plan, (settings, isLead) => describeSheetProblem({ catalog, hasKey }, settings, isLead));
  const assigned = CORE_CAMERA_NAMES.map((_, camera) => plan.sheets.some((sheet) => sheet.cameras.includes(camera)));
  const previews = useMemo(() => previewsOf(plan), [previewsOf, plan]);
  const fields = { catalog, hasKey, maxTextureSize, today };

  const startDrag = (item: Dragged, event: React.DragEvent): void => {
    dragged.current = item;
    event.dataTransfer.setData('text/plain', item.kind === 'camera' ? `camera:${item.camera}` : `sheet:${item.index}`);
    event.dataTransfer.effectAllowed = 'move';
    const handle = event.currentTarget as HTMLElement;
    const card = handle.closest<HTMLElement>('.setup-card');
    // The marked element dims itself by its own attribute: a camera thumbnail, or the whole card when a card is carried (no :has() rule over every card).
    if (item.kind === 'camera') markDragSource(handle, event, handle.querySelector('img'));
    else if (card !== null) markDragSource(card, event, card);
  };
  // R3: what a drop on a card or on the row would do, written on the target while the pointer is over it.
  // A dragged camera lights the drop area ("Add Front here"); a dragged card marks the edge of the hovered card where it would land.
  const hintDrop = (target: 'card' | 'row', index = -1) => (event: React.DragEvent): void => {
    const item = dragged.current;
    if (item === null || (item.kind === 'sheet' && target === 'row')) return;
    const current = event.currentTarget as HTMLElement;
    if (item.kind === 'sheet') {
      if (item.index !== index) showDropEdge(current, item.index < index ? 'after' : 'before');
      return;
    }
    showDropHint(current, target === 'row' ? 'Take off the image' : `Add ${nameOf(item.camera)} here`);
  };
  const unhintDrop = (event: React.DragEvent): void => {
    if (hasLeftTarget(event)) clearDropHint(event.currentTarget as HTMLElement);
  };
  const dropOnSheet = (target: number, event: React.DragEvent): void => {
    event.preventDefault();
    clearDropHint(event.currentTarget as HTMLElement);
    const item = dragged.current;
    dragged.current = null;
    if (item === null) return;
    if (item.kind === 'camera') edit(assignCamera(plan, item.camera, target), `${nameOf(item.camera)} added to image ${target + 1}.`);
    else edit(reorderSheets(plan, item.index, target), `Image ${item.index + 1} moved to place ${target + 1}.`);
  };
  const dropOnRow = (event: React.DragEvent): void => {
    event.preventDefault();
    clearDropHint(event.currentTarget as HTMLElement);
    const item = dragged.current;
    dragged.current = null;
    if (item?.kind === 'camera') edit(unassignCamera(plan, item.camera), `${nameOf(item.camera)} is not on any image.`);
  };
  const pick = (camera: number): void => {
    if (picked === camera) return putDown();
    setPicked(camera);
    setTarget(plan.sheets.findIndex((sheet) => sheet.cameras.includes(camera))); // its own card, or the row (-1) when it is on none
    setAnnouncement(`${nameOf(camera)} picked up. Choose an image to add it to.`);
  };
  // Custom R8: the arrows move the marker of the picked camera (row, then the cards), Space or Enter drops it there.
  const steerPicked = (camera: number, event: React.KeyboardEvent): void => {
    if (picked !== camera) return;
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') {
      event.preventDefault();
      setTarget(Math.min(plan.sheets.length - 1, target + 1));
    } else if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') {
      event.preventDefault();
      setTarget(Math.max(ROW_TARGET, target - 1));
    } else if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      swallowSpaceRelease.current = event.key === ' ';
      if (target === ROW_TARGET) edit(unassignCamera(plan, camera), `${nameOf(camera)} is not on any image.`);
      else edit(assignCamera(plan, camera, target), `${nameOf(camera)} moved to image ${target + 1}.`);
      setPicked(null);
    }
  };
  // The key coming up after the dropping Space would click the snapshot button and pick the camera up again.
  const releaseKey = (event: React.KeyboardEvent): void => {
    if (event.key !== ' ' || !swallowSpaceRelease.current) return;
    event.preventDefault();
    swallowSpaceRelease.current = false;
  };
  // R5: with Sync settings on, one image's settings go to every image.
  const changeSettings = (target: number | 'aux', settings: SheetSettings): void => {
    edit(syncSettings ? applySettingsToAll(plan, settings) : updateSheetSettings(plan, target, settings));
  };
  const moveSheet = (index: number, delta: -1 | 1): void => {
    edit(reorderSheets(plan, index, index + delta), `Image ${index + 1} moved to place ${index + delta + 1}.`);
  };

  return (
    <div className="setup-overlay" data-testid="setup-backdrop">
      <div className="setup-overlay__panel" ref={panel} role="region" aria-label="Custom generation setup">
        <SnapshotRow
          snapshots={snapshots}
          trims={trims}
          assigned={assigned}
          picked={picked}
          onPick={pick}
          onUnassign={(camera) => {
            edit(unassignCamera(plan, camera), `${nameOf(camera)} is not on any image.`);
            setPicked(null);
          }}
          onDragStart={(camera, event) => startDrag({ kind: 'camera', camera }, event)}
          onDrop={dropOnRow}
          onDragEnter={hintDrop('row')}
          onDragLeave={unhintDrop}
          targeted={picked !== null && target === ROW_TARGET}
          onKeyDown={steerPicked}
          onKeyUp={releaseKey}
        />
        <SetupToolbar
          presets={PRESETS}
          activePreset={presetModel === null ? 'custom' : detectPreset(plan, presetModel)}
          plan={plan}
          presetsEnabled={presetModel !== null}
          savedSetups={savedSetups}
          syncSettings={syncSettings}
          onSyncSettingsChange={(on) => {
            setSyncSettings(on);
            const lead = plan.sheets[0]?.settings ?? plan.aux?.settings;
            if (on && lead !== undefined) edit(applySettingsToAll(plan, lead));
          }}
          onPreset={(preset) => presetModel !== null && edit(buildPresetPlan(preset, presetModel))}
          onLoad={(setup) => edit(setup.plan)}
          onDelete={onDeleteSetup}
          onSave={(name) => onSaveSetup(name, plan)}
        />
        <div className="setup-overlay__body">
          <div className="setup-overlay__grid" data-testid="sheet-grid">
            {plan.sheets.map((sheet, index) => (
              <SheetCard
                key={index}
                number={index + 1}
                sheet={sheet}
                snapshots={snapshots}
                trims={trims}
                preview={previews[index] ?? null}
                pickedCamera={picked}
                isTarget={picked !== null && target === index}
                isFirst={index === 0}
                isLast={index === plan.sheets.length - 1}
                fields={fields}
                onSettings={(settings) => changeSettings(index, settings)}
                onRemove={() => edit(removeSheet(plan, index))}
                onMove={(delta) => moveSheet(index, delta)}
                onRemoveCamera={(camera) => edit(unassignCamera(plan, camera))}
                onAddPicked={() => {
                  if (picked === null) return;
                  edit(assignCamera(plan, picked, index), `${nameOf(picked)} added to image ${index + 1}.`);
                  setPicked(null);
                }}
                onDragStart={(event) => startDrag({ kind: 'sheet', index }, event)}
                onCameraDragStart={(camera, event) => startDrag({ kind: 'camera', camera }, event)}
                onDragEnter={hintDrop('card', index)}
                onDragLeave={unhintDrop}
                onDrop={(event) => dropOnSheet(index, event)}
              />
            ))}
            {plan.sheets.length < MAX_CORE_SHEETS && (
              <button type="button" className="setup-add-tile" aria-label="Add another image" onClick={() => edit(addSheet(plan, defaults))}>
                <Icon name="plus" size={28} />
              </button>
            )}
            <AuxSheetCard
              aux={plan.aux}
              preview={previews[plan.sheets.length] ?? null}
              fields={fields}
              onIncludedChange={(included) => edit(setAuxIncluded(plan, included, defaults))}
              onSettings={(settings) => changeSettings('aux', settings)}
            />
          </div>
        </div>
        <div className="setup-overlay__footer">
          <span className="setup-overlay__decision">
            <Button variant="ghost" onClick={onCancel}>Cancel</Button>
            <Button variant="primary" disabled={problem !== null} {...(problem === null ? {} : { title: problem })} onClick={() => onConfirm(plan)}>Confirm</Button>
          </span>
        </div>
        <p className="setup-overlay__announcement" role="status" aria-live="polite" data-testid="setup-announcement">{announcement}</p>
      </div>
    </div>
  );
}
