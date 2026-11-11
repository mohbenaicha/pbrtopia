import { Checkbox } from '@shared/ui-kit';
import { findCatalogModel } from '@shared/generation';
import type { CardReport, GenerationPanel, SheetSettings } from '@mat/generation';
import { CardSettingsFields } from '../generate/CardSettingsFields';
import { layoutForCard, LayoutCaption, LayoutPreview } from './LayoutPreview';

interface DecompositionCardProps {
  generation: GenerationPanel;
  card: CardReport | undefined; // the inspected card; undefined while the card is not included
  canInclude: boolean; // false when no model is known to start the card from
  onIncludedChange(included: boolean): void;
  onSettings(settings: SheetSettings): void;
}

/** Generation R15, R19: the fixed last card, "Metal-Roughness": the Include box, then its model, resolution and quality and its 1x1 preview while ticked. It accepts no chips. */
export function DecompositionCard({ generation, card, canInclude, onIncludedChange, onSettings }: DecompositionCardProps): React.JSX.Element {
  const settings = card?.settings ?? null;
  const model = settings === null ? null : findCatalogModel(generation.displayCatalog, settings.provider, settings.modelId);
  const choice = settings === null ? null : layoutForCard(model, settings, 1);
  return (
    <section className="setup-card setup-card--aux" role="group" aria-label="Metal-Roughness">
      <Checkbox label="Include" checked={card !== undefined} disabled={card === undefined && !canInclude} onChange={onIncludedChange} />
      <p className="material-panel__hint">Segmentation image used to derive roughness and metal.</p>
      {settings !== null && (
        <>
          <div className="setup-drop setup-drop--aux" data-testid="canvas-box">
            <LayoutPreview choice={choice} tileNames={['']} />
          </div>
          <LayoutCaption choice={choice} mapCount={1} />
          <CardSettingsFields name="Metal-Roughness" settings={settings} mapCount={1} catalog={generation.displayCatalog} hasKey={generation.models.hasKey} maxTextureSize={generation.maxTextureSize} disabled={false} onChange={onSettings} />
          {card?.problem != null && <p className="model-card__problem" role="alert">{card.problem}</p>}
        </>
      )}
    </section>
  );
}
