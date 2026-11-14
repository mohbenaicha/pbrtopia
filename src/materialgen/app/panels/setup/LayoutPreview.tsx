import { chooseLayout, describeLayoutProblem, gridName, type LayoutChoice } from '@mat/generation';
import type { ProviderModelRecord } from '@shared/generation';
import { Tooltip } from '@shared/ui-kit';
import type { SheetSettings } from '@mat/generation';

/** The layout the run will use for a card, from the very function the run calls (generation R14, R23); null while the model is not in the list. */
export const layoutForCard = (model: ProviderModelRecord | null, settings: SheetSettings, mapCount: number): LayoutChoice | null =>
  model === null ? null : chooseLayout(model.canvases, settings.resolutionKey, Math.max(1, mapCount));

const percent = (fraction: number): string => `${Number((fraction * 100).toFixed(4))}%`;

interface LayoutPreviewProps {
  choice: LayoutChoice | null;
  tileNames: string[]; // one per tile, in the reading order of the grid
}

/** Generation R14, R25: the canvas at its aspect with each tile where the run puts it and named; or the reason the card has no layout, in its place. */
export function LayoutPreview({ choice, tileNames }: LayoutPreviewProps): React.JSX.Element | null {
  if (choice === null) return null;
  if (!choice.ok) return <p className="setup-preview__problem" role="alert">{describeLayoutProblem(choice)}</p>;
  const { canvas, tiles } = choice.layout;
  return (
    <div className="setup-canvas" data-testid="sheet-preview" style={{ '--drop-aspect': String(canvas.width / canvas.height) } as React.CSSProperties}>
      {tiles.map((tile, index) => (
        <span
          key={tileNames[index] ?? index}
          className="setup-canvas__tile map-tile"
          style={{ left: percent(tile.x / canvas.width), top: percent(tile.y / canvas.height), width: percent(tile.width / canvas.width), height: percent(tile.height / canvas.height) }}
        >
          <Tooltip heading={tileNames[index] ?? ''} text=""><span className="map-tile__name">{tileNames[index]}</span></Tooltip>
        </span>
      ))}
    </div>
  );
}

/** Generation R14, R50: "Canvas 2048 x 1024 - tiles 1008 px - 2x1", and for two maps or more the alignment caveat. Nothing when there is no valid layout. */
export function LayoutCaption({ choice, mapCount }: { choice: LayoutChoice | null; mapCount: number }): React.JSX.Element | null {
  if (choice === null || !choice.ok) return null;
  const { canvas, tileSide, grid } = choice.layout;
  return (
    <>
      <p className="setup-preview__caption">{`Canvas ${canvas.width} x ${canvas.height} - tiles ${tileSide} px - ${gridName(grid)}`}</p>
      {mapCount >= 2 && <p className="setup-preview__caveat">Maps from one image may not line up exactly</p>}
    </>
  );
}
