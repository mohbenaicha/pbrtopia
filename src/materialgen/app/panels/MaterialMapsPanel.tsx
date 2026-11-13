import type { ReactNode } from 'react';
import type { RawRecord } from '@shared/projects';
import { PlainLeftPanel } from '@shared/shell';
import type { MapsController, MapsState } from '@mat/maps';
import { PreviewShadingControl, type PreviewShading } from '@mat/preview';
import type { ColorMode, MaterialRecord } from '@mat/storage';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import { MapCards } from './MapCards';
import type { HeldToolView } from './tools/useGeometryTools';
import './materialPanels.css';

interface MaterialMapsPanelProps {
  shading: PreviewShading; // the preview's shading mode, chosen at the top of the panel as in the projection app's Materials tab (preview R51)
  onShadingChange(shading: PreviewShading): void;
  mapsState: MapsState;
  maps: MapsController;
  readBlob(key: string): Promise<Blob | null>;
  sessions: ImageopsSessions;
  aoParams: MaterialRecord['aoParams'];
  onAoParamsChange(next: NonNullable<MaterialRecord['aoParams']>): void;
  colorMode: ColorMode;
  canWrite: boolean;
  onToolViewChange(view: HeldToolView | null): void; // the transform an open Crop or Mirror puts on the viewport's maps (imageops R53)
  masksRecord?: RawRecord | undefined; // the project's masks, for the filter dialog's mask swatches (imageops R78)
  children?: ReactNode; // the export dialog and its message (materialgen/export R20, R34), opened from the top bar
}

/**
 * Materialgen app R14, R20: the left panel, holding the material as the projection app's left panel holds the project's content: the five slot
 * cards (collapsible panels, picture with its buttons over it), top to bottom, then the export message. The Material Masks controls are not here (masks R48).
 */
export function MaterialMapsPanel({
  shading, onShadingChange, mapsState, maps, readBlob, sessions, aoParams, onAoParamsChange, colorMode, canWrite, onToolViewChange, masksRecord, children,
}: MaterialMapsPanelProps): React.JSX.Element {
  return (
    <PlainLeftPanel>
      <div className="material-slots">
        <PreviewShadingControl value={shading} onChange={onShadingChange} />
        <MapCards state={mapsState} colorMode={colorMode} canWrite={canWrite} controller={maps} readBlob={readBlob} sessions={sessions} aoParams={aoParams} onAoParamsChange={onAoParamsChange} onToolViewChange={onToolViewChange} masksRecord={masksRecord} />
        {children}
      </div>
    </PlainLeftPanel>
  );
}
