import { useState } from 'react';
import { findCatalogModel } from '@shared/generation';
import { SegmentedControl, Select, Toggle, type SegmentOption } from '@shared/ui-kit';
import {
  buildCardSettings, mapDisplayName, setDecompositionIncluded, setDecompositionSettings, setImageSettings,
  type CardReport, type GenerationPlan, type GenerationPanel, type SheetSettings,
} from '@mat/generation';
import type { ColorMode } from '@mat/storage';
import { CardSettingsFields } from './CardSettingsFields';

interface ModelSettingsSectionProps {
  generation: GenerationPanel;
  colorMode: ColorMode;
  disabled: boolean;
}

const DECOMPOSITION_NAME = 'Metal-Roughness';
const DECOMPOSITION_VALUE = 'decomposition';

const cardValue = (card: CardReport): string => (card.card === 'decomposition' ? DECOMPOSITION_VALUE : `image-${card.card}`);
/** A map image is named by its maps ("Albedo", "Normal + Height"), as the setup overlay's chips are; an image with none is "Image N". */
const cardName = (card: CardReport, colorMode: ColorMode): string =>
  card.card === 'decomposition' ? DECOMPOSITION_NAME : card.maps.length === 0 ? `Image ${card.card + 1}` : card.maps.map((map) => mapDisplayName(map, colorMode)).join(' + ');

/**
 * Generation R1, R13, R15, R16, R19, R67: the Preset, a toggle row with one button per card of the plan (named by its maps, then Metal-Roughness), and one settings group
 * (Model, Resolution, Quality) for the chosen card with its own problem. Metal-Roughness has an on/off switch. An edit replaces the plan, so the Preset then shows what the
 * plan matches, or Custom (R4).
 */
export function ModelSettingsSection({ generation, colorMode, disabled }: ModelSettingsSectionProps): React.JSX.Element {
  const { choice, models, report, maxTextureSize } = generation;
  const [chosen, setChosen] = useState<string>(report.cards[0] === undefined ? DECOMPOSITION_VALUE : cardValue(report.cards[0]));
  const edit = (change: (plan: GenerationPlan) => GenerationPlan): void => choice.replacePlan(change(choice.plan));
  const lead = report.cards[0]?.settings;
  const leadModel = lead === undefined ? null : findCatalogModel(generation.displayCatalog, lead.provider, lead.modelId);

  const options: SegmentOption<string>[] = [
    ...report.cards.filter((card) => card.card !== 'decomposition').map((card) => ({ value: cardValue(card), label: cardName(card, colorMode) })),
    { value: DECOMPOSITION_VALUE, label: DECOMPOSITION_NAME },
  ];
  const selectedValue = options.some((option) => option.value === chosen) ? chosen : (options[0]?.value ?? DECOMPOSITION_VALUE);
  const card = report.cards.find((candidate) => cardValue(candidate) === selectedValue);
  const isDecomposition = selectedValue === DECOMPOSITION_VALUE;

  const changeCard = (target: CardReport, settings: SheetSettings): void =>
    edit((plan) => (target.card === 'decomposition' ? setDecompositionSettings(plan, settings) : setImageSettings(plan, target.card, settings)));

  return (
    <div className="model-settings">
      <Select label="Preset" options={choice.choices} value={choice.entry} disabled={disabled} onChange={choice.choose} />
      <SegmentedControl label="Card" options={options} value={selectedValue} onChange={setChosen} />
      <section className="model-card" aria-label={card === undefined ? DECOMPOSITION_NAME : cardName(card, colorMode)}>
        {isDecomposition && (
          <Toggle
            label="Generate metal and roughness"
            checked={card !== undefined}
            disabled={disabled || (card === undefined && leadModel === null)}
            hint="Makes the segmentation image that roughness and metal are derived from."
            onChange={(on) =>
              edit((plan) => (on && leadModel !== null ? setDecompositionIncluded(plan, true, buildCardSettings(leadModel, maxTextureSize, 1)) : card === undefined ? plan : setDecompositionIncluded(plan, false, card.settings)))
            }
          />
        )}
        {card !== undefined && (
          <CardSettingsFields
            name=""
            settings={card.settings}
            mapCount={Math.max(1, card.maps.length)}
            catalog={generation.displayCatalog}
            hasKey={models.hasKey}
            maxTextureSize={maxTextureSize}
            disabled={disabled}
            onChange={(settings) => changeCard(card, settings)}
          />
        )}
        {card?.problem != null && <p className="model-card__problem" role="alert">{card.problem}</p>}
      </section>
    </div>
  );
}
