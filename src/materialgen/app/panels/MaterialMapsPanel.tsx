import type { ReactNode } from 'react';
import type { RawRecord } from '@shared/projects';
import { PlainLeftPanel } from '@shared/shell';
import type { MapsController, MapsState } from '@mat/maps';
import type { BaseMaterialTable, MasksModelControls } from '@mat/masks';
import { PreviewShadingControl, type PreviewShading } from '@mat/preview';
import type { ColorMode, MaterialRecord } from '@mat/storage';
import type { ImageopsSessions } from '../imageops/useImageopsSessions';
import type { MaskView } from '../project/useMaskView';
import { MapCards } from './MapCards';
import type { HeldToolView } from './tools/useGeometryTools';
import { MasksSection } from './masks/MasksSection';
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
  masksRecord: RawRecord | undefined; // the masks record of the material (masks R41)
  loadMaterialTable(): Promise<BaseMaterialTable>; // the base materials, loaded when the masks section is first opened (masks R34)
  maskView: MaskView; // the Material Masks section's open state and the overlay switch, shared with the viewport icon (preview R28)
  masksModel: MasksModelControls; // the model path of the Material Masks section (masks R64-R68)
  onToolViewChange(view: HeldToolView | null): void; // the transform an open Crop or Mirror puts on the viewport's maps (imageops R53)
  children?: ReactNode; // the export dialog and its message (materialgen/export R20, R34), opened from the top bar
}

/**
 * Materialgen app R14, R20: the left panel, holding the material as the projection app's left panel holds the project's content: the five slot
 * cards (collapsible panels, picture with its buttons over it) and the Material Masks section, top to bottom, then the export message.
 */
export function MaterialMapsPanel({
  shading, onShadingChange, mapsState, maps, readBlob, sessions, aoParams, onAoParamsChange, colorMode, canWrite,
  masksRecord, loadMaterialTable, maskView, masksModel, onToolViewChange, children,
}: MaterialMapsPanelProps): React.JSX.Element {
  return (
    <PlainLeftPanel>
      <div className="material-slots">
        <PreviewShadingControl value={shading} onChange={onShadingChange} />
        <MapCards state={mapsState} colorMode={colorMode} canWrite={canWrite} controller={maps} readBlob={readBlob} sessions={sessions} aoParams={aoParams} onAoParamsChange={onAoParamsChange} onToolViewChange={onToolViewChange} />
        <MasksSection state={mapsState} masksRecord={masksRecord} canWrite={canWrite} controller={maps} readBlob={readBlob} loadTable={loadMaterialTable} model={masksModel} overlay={maskView.overlay} onOverlay={maskView.onOverlay} open={maskView.open} onOpenChange={maskView.onOpenChange} />
        {children}
      </div>
    </PlainLeftPanel>
  );
}
