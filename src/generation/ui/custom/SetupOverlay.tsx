import { useMemo, useState } from 'react';
import type { Provider } from '../../../keys';
import { addSheet, applySettingsToAll, assignCamera, describePlanProblem, removeSheet, reorderSheets, setAuxIncluded, unassignCamera, updateSheetSettings } from '../../custom/planEditing';
import { CORE_CAMERA_NAMES, MAX_CORE_SHEETS, type CustomPlanRecord, type NamedPlanRecord, type SheetSettings } from '../../custom/planTypes';
import type { SheetPreview, SnapshotTrim } from '../../custom/sheetPreview';
import { buildPresetPlan, buildPresetSettings, detectPreset, pickPresetModel, type PresetName } from '../../custom/presets';
import { describeSheetProblem } from '../../generateAvailability';
import type { ModelCatalog } from '../../generateStore';
import type { AtlasRender } from '../../atlasRender';
import { AtlasPreviewViewer } from '../AtlasPreviewViewer';
import { AtlasRenderSelect } from '../AtlasRenderSelect';
import { AssignmentOverlay } from '../assignment/AssignmentOverlay';
import type { AssignmentCardView, AssignmentItem } from '../assignment/assignmentTypes';
import { PlanToolbar } from '../assignment/PlanToolbar';
import { AuxSheetCard } from './AuxSheetCard';
import { CameraThumb } from './CameraThumb';
import { SheetPreviewCanvas } from './SheetPreviewCanvas';
import { SheetSettingsFields } from './SheetSettingsFields';
import { useAuxPreview } from './useAuxPreview';

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
  atlasRender: AtlasRender; // R52: the panel's Atlas render, shown in the toolbar
  onAtlasRenderChange: (render: AtlasRender) => void;
  auxiliary?: boolean; // false from Metal-Roughness (mask-generation R17): no auxiliary card, no "+ auxiliary" in the presets, the aux sheet is not judged; true by default
  onPreviewAux?: (plan: CustomPlanRecord) => Promise<{ ok: true; value: Blob } | { ok: false; error: string }>; // R51: the aux sheet as a run would send it, for this plan; no Preview atlas button without it
}

const PRESETS: readonly { id: PresetName; label: string }[] = [
  { id: 'default', label: 'Default: 4 images' },
  { id: 'two-two-two', label: '2-2-2: 3 images of 2 views' },
  { id: 'three-images', label: '3-3: 2 images of 3 views' },
];
const AUX_PRESETS = PRESETS.map((preset) => ({ ...preset, label: `${preset.label} + auxiliary` }));

const FALLBACK_SETTINGS: SheetSettings = { provider: 'openai', modelId: '', resolutionKey: '1K', quality: null };

/**
 * Custom R2-R8: the projection app's setup overlay, an adapter over the shared AssignmentOverlay (prep S3 R24). It holds the plan and its edits; the items are the six core
 * cameras, the cards are the sheets, and the fixed card is the auxiliary sheet.
 */
export function SetupOverlay({ activePlan, snapshots, trims, previewsOf, catalog, hasKey, maxTextureSize, today, savedSetups, onConfirm, onCancel, onSaveSetup, onDeleteSetup, atlasRender, onAtlasRenderChange, auxiliary = true, onPreviewAux }: SetupOverlayProps): React.JSX.Element {
  const presetModel = pickPresetModel(catalog, hasKey);
  const [plan, setPlan] = useState<CustomPlanRecord>(() => activePlan ?? (presetModel === null ? { sheets: [], aux: null } : buildPresetPlan('default', presetModel)));
  const [syncSettings, setSyncSettings] = useState(true); // R5: on at first
  const auxPreview = useAuxPreview(onPreviewAux);
  const defaults = presetModel === null ? FALLBACK_SETTINGS : buildPresetSettings(presetModel);
  const previews = useMemo(() => previewsOf(plan), [previewsOf, plan]);
  const fields = { catalog, hasKey, maxTextureSize, today };

  const items: AssignmentItem[] = CORE_CAMERA_NAMES.map((name, camera) => ({ id: camera, name, thumb: <CameraThumb blob={snapshots?.[camera] ?? null} trim={trims?.[camera] ?? null} /> }));
  // R5: with Sync settings on, one image's settings go to every image.
  const changeSettings = (target: number | 'aux', settings: SheetSettings): void => {
    setPlan((current) => (syncSettings ? applySettingsToAll(current, settings) : updateSheetSettings(current, target, settings)));
  };
  const cards: AssignmentCardView[] = plan.sheets.map((sheet, index) => ({
    itemIds: sheet.cameras,
    preview: previews[index] === null || previews[index] === undefined ? null : <SheetPreviewCanvas preview={previews[index]} snapshots={snapshots} trims={trims} />,
    settings: <SheetSettingsFields {...fields} name={`Image ${index + 1}`} settings={sheet.settings} onChange={(settings) => changeSettings(index, settings)} />,
  }));
  const judged = auxiliary ? plan : { ...plan, aux: null }; // R17: a mask run never uses the aux sheet, so its model cannot block Confirm
  const problem = describePlanProblem(judged, (settings, isLead) => describeSheetProblem({ catalog, hasKey }, settings, isLead || !auxiliary)); // masks: no reference images, every sheet is a lead

  const toolbar = (
    <PlanToolbar
      presets={auxiliary ? AUX_PRESETS : PRESETS}
      activePreset={presetModel === null ? 'custom' : detectPreset(plan, presetModel)}
      chosenSetup={savedSetups.find((setup) => JSON.stringify(setup.plan) === JSON.stringify(plan))?.name ?? null}
      presetsEnabled={presetModel !== null}
      savedSetups={savedSetups}
      syncSettings={syncSettings}
      namePlaceholder="Orc head"
      onSyncSettingsChange={(on) => {
        setSyncSettings(on);
        if (!on) return;
        setPlan((current) => {
          const lead = current.sheets[0]?.settings ?? current.aux?.settings;
          return lead === undefined ? current : applySettingsToAll(current, lead);
        });
      }}
      onPreset={(preset) => presetModel !== null && setPlan(buildPresetPlan(preset as PresetName, presetModel))}
      onLoad={(setup) => setPlan(setup.plan)}
      onDelete={onDeleteSetup}
      onSave={(name) => onSaveSetup(name, plan)}
      extraControl={<AtlasRenderSelect value={atlasRender} onChange={onAtlasRenderChange} masks={!auxiliary} opensUp={false} />} // R52; masks: only Metal-Roughness hides the aux card
    />
  );

  return (
    <>
    <AssignmentOverlay
      labels={{ region: 'Custom generation setup', row: 'Snapshots', emptyDrop: 'Drop a perspective here', ...(snapshots === null ? { busy: 'Taking snapshots' } : {}) }}
      items={items}
      cards={cards}
      maxCards={MAX_CORE_SHEETS}
      canRemoveCard={() => true}
      reorderable
      toolbar={toolbar}
      aux={
        auxiliary ? (
          <AuxSheetCard
            aux={plan.aux}
            preview={previews[plan.sheets.length] ?? null}
            fields={fields}
            onIncludedChange={(included) => setPlan((current) => setAuxIncluded(current, included, defaults))}
            onSettings={(settings) => changeSettings('aux', settings)}
            onPreviewAtlas={onPreviewAux === undefined ? undefined : () => void auxPreview.show(plan)}
            previewing={auxPreview.busy}
            previewMessage={auxPreview.message}
          />
        ) : undefined
      }
      problem={problem}
      onAssign={(camera, sheet) => setPlan((current) => assignCamera(current, camera, sheet))}
      onUnassign={(camera) => setPlan((current) => unassignCamera(current, camera))}
      onReorder={(from, to) => setPlan((current) => reorderSheets(current, from, to))}
      onAddCard={() => setPlan((current) => addSheet(current, defaults))}
      onRemoveCard={(index) => setPlan((current) => removeSheet(current, index))}
      onConfirm={() => onConfirm(plan)}
      onCancel={onCancel}
    />
    {auxPreview.picture !== null && <AtlasPreviewViewer png={auxPreview.picture} onClose={auxPreview.close} />}
    </>
  );
}
