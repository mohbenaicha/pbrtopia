import { useState } from 'react';
import { Checkbox, Disclosure, Icon, IconButton } from '../../ui-kit';
import type { AtlasRender } from '../atlasRender';
import type { AtlasKey, AtlasSizeOption } from '../catalog/atlasSizes';
import { AtlasRenderSelect } from './AtlasRenderSelect';
import { AtlasSizeSelect } from './AtlasSizeSelect';
import './AdditionalSettings.css';

interface AdditionalSettingsProps {
  atlasSizes: AtlasSizeOption[];
  atlasKey: AtlasKey;
  onAtlasKeyChange: (key: AtlasKey) => void;
  atlasRender: AtlasRender;
  onAtlasRenderChange: (render: AtlasRender) => void;
  tileBorder: boolean;
  onTileBorderChange: (on: boolean) => void;
  previewing: boolean; // the preview atlas is being built (R38)
  previewBlockedReason: string | null; // why the preview cannot be asked for now, or null
  onPreview: () => void;
  custom: boolean; // custom R12: no Atlas size and no atlas preview (the sheets are sized per sheet)
}

// R36: the closed-at-first section under Quality. Atlas size (R16), then Atlas render (R37) with the eye button that previews the atlas (R38), then Tile borders (R40).
// In Custom (custom R12) Atlas size and the eye are left out; the render and the borders apply to every sheet.
export function AdditionalSettings({ atlasSizes, atlasKey, onAtlasKeyChange, atlasRender, onAtlasRenderChange, tileBorder, onTileBorderChange, previewing, previewBlockedReason, onPreview, custom }: AdditionalSettingsProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure title="Additional settings" open={open} onOpenChange={setOpen} keepMounted>
      <div className="additional-settings">
        {!custom && <AtlasSizeSelect options={atlasSizes} value={atlasKey} onChange={onAtlasKeyChange} />}
        <div className="additional-settings__render">
          <div className="additional-settings__render-select">
            <AtlasRenderSelect value={atlasRender} onChange={onAtlasRenderChange} />
          </div>
          {!custom && (
            <IconButton
              label="Preview atlas"
              icon={<Icon name="eye" />}
              loading={previewing}
              disabled={previewBlockedReason !== null}
              {...(previewBlockedReason === null ? {} : { disabledReason: previewBlockedReason })}
              onClick={onPreview}
            />
          )}
        </div>
        <Checkbox label="Tile borders" hint="Asks the model to make the left and right edges, and the top and bottom, match so the texture tiles." checked={tileBorder} onChange={onTileBorderChange} />
      </div>
    </Disclosure>
  );
}
