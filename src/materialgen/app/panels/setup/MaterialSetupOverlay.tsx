import { useMemo } from 'react';
import { AssignmentOverlay, PlanToolbar, findCatalogModel, type AssignmentCardView, type AssignmentItem } from '@shared/generation';
import { Tooltip } from '@shared/ui-kit';
import {
  buildPresetPlan, describePreset, detectPlanEntry, MAX_MAP_IMAGES, PLAN_MAPS, PRESET_IDS, mapDisplayName, savedSetupValue,
  type GenerationPanel, type PlanMap,
} from '@mat/generation';
import type { ColorMode } from '@mat/storage';
import { CardSettingsFields } from '../generate/CardSettingsFields';
import { DecompositionCard } from './DecompositionCard';
import { layoutForCard, LayoutCaption, LayoutPreview } from './LayoutPreview';
import { MapChipThumb } from './MapChipThumb';
import { useSetupDraft } from './useSetupDraft';
import '../generate/generatePanels.css';
import './setupOverlay.css';

interface MaterialSetupOverlayProps {
  generation: GenerationPanel;
  colorMode: ColorMode;
  onClose(): void;
}

const METAL_ROUGHNESS_NOTE = 'Metal-Roughness has its own image. Choose it with the Include box of the Metal-Roughness card.';
const HEIGHT_NOTE = 'Also used to generate the normal map and the occlusion map automatically.';
const PRESETS =PRESET_IDS.map((id) => ({ id, label: describePreset(id) }));

/**
 * Generation R10-R20: the setup overlay of the material app, an adapter over the shared AssignmentOverlay. It edits a copy of the plan; Confirm makes it the active plan,
 * Cancel and Escape drop it. The items are Albedo and Height; the cards are the map images; the fixed card is Metal-Roughness.
 */
export function MaterialSetupOverlay({ generation, colorMode, onClose }: MaterialSetupOverlayProps): React.JSX.Element {
  const { choice, displayCatalog, maxTextureSize, environment, models } = generation;
  const draft = useSetupDraft({ start: choice.plan, environment, displayCatalog, maxTextureSize });
  const { plan, report } = draft;

  const items = useMemo<AssignmentItem[]>(
    () => PLAN_MAPS.map((map, id) => ({ id, name: mapDisplayName(map, colorMode), thumb: <MapChipThumb map={map} />, ...(map === 'height' ? { note: HEIGHT_NOTE } : {}) })),
    [colorMode],
  );
  const mapAt = (id: number): PlanMap | undefined => PLAN_MAPS[id];

  const cards: AssignmentCardView[] = plan.images.map((image, index) => {
    const model = findCatalogModel(displayCatalog, image.settings.provider, image.settings.modelId);
    const layout = layoutForCard(model, image.settings, image.maps.length);
    const problem = report.cards.find((card) => card.card === index)?.problem ?? null;
    return {
      itemIds: image.maps.map((map) => PLAN_MAPS.indexOf(map)),
      lead: image.maps.includes('albedo'), // R13: the card holding Albedo is the lead
      preview: image.maps.length === 0 ? null : <LayoutPreview choice={layout} tileNames={image.maps.map((map) => mapDisplayName(map, colorMode))} />,
      below: image.maps.length === 0 ? undefined : <LayoutCaption choice={layout} mapCount={image.maps.length} />,
      settings: (
        <>
          <CardSettingsFields name={`Image ${index + 1}`} settings={image.settings} mapCount={Math.max(1, image.maps.length)} catalog={displayCatalog} hasKey={models.hasKey} maxTextureSize={maxTextureSize} disabled={false} onChange={(settings) => draft.changeCard(index, settings)} />
          {problem !== null && <p className="model-card__problem" role="alert">{problem}</p>}
        </>
      ),
    };
  });

  const entry = detectPlanEntry(plan, choice.saved, models.catalog, maxTextureSize);
  const decomposition = report.cards.find((card) => card.card === 'decomposition');

  return (
    <AssignmentOverlay
      labels={{ region: 'Custom generation setup', row: 'Maps', emptyDrop: 'Drop a map here', assignedTo: (number) => `Image ${number}` }}
      items={items}
      rowExtra={
        <figure className="setup-snapshots__item" data-assigned={plan.decomposition === null ? 'false' : 'true'}>
          <Tooltip heading="Metal-Roughness" text={METAL_ROUGHNESS_NOTE}>
            <button type="button" className="setup-snapshots__button" aria-label="Metal-Roughness" aria-disabled="true">
              <span className="setup-thumb-slot">
                <span className="map-chip-thumb map-chip-thumb--metal-roughness" aria-hidden="true" />
              </span>
            </button>
          </Tooltip>
          <figcaption>Metal-Roughness</figcaption>
        </figure>
      }
      cards={cards}
      maxCards={MAX_MAP_IMAGES}
      canRemoveCard={() => true}
      reorderable={false}
      toolbar={
        <PlanToolbar
          presets={PRESETS}
          activePreset={PRESET_IDS.includes(entry) ? entry : 'custom'}
          chosenSetup={choice.saved.find((setup) => savedSetupValue(setup.name) === entry)?.name ?? null}
          presetsEnabled
          savedSetups={choice.saved}
          syncSettings={draft.sync}
          namePlaceholder="Mossy bricks"
          onSyncSettingsChange={draft.setSync}
          onPreset={(id) => {
            const next = buildPresetPlan(id, models.catalog, maxTextureSize);
            if (next !== null) draft.load(next);
          }}
          onLoad={(setup) => draft.load(setup.plan)}
          onDelete={choice.deleteSetup}
          onSave={(name) => choice.saveSetup(name, plan)}
        />
      }
      aux={<DecompositionCard generation={generation} card={decomposition} canInclude onIncludedChange={draft.setIncluded} onSettings={(settings) => draft.changeCard('decomposition', settings)} />}
      problem={report.problem}
      onAssign={(id, image) => {
        const map = mapAt(id);
        if (map !== undefined) draft.assign(map, image);
      }}
      onUnassign={(id) => {
        const map = mapAt(id);
        if (map !== undefined) draft.unassign(map);
      }}
      onReorder={() => undefined}
      onAddCard={draft.addCard}
      onRemoveCard={draft.removeCard}
      onConfirm={() => {
        choice.replacePlan(plan);
        onClose();
      }}
      onCancel={onClose}
    />
  );
}
