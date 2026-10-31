import { useState } from 'react';
import { Disclosure, Icon, IconButton } from '../../ui-kit';
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
  previewing: boolean; // the preview atlas is being built (R38)
  previewBlockedReason: string | null; // why the preview cannot be asked for now, or null
  onPreview: () => void;
}

// R36: the closed-at-first section under Quality. Atlas size (R16), then Atlas render (R37) with the eye button that previews the atlas (R38).
export function AdditionalSettings({ atlasSizes, atlasKey, onAtlasKeyChange, atlasRender, onAtlasRenderChange, previewing, previewBlockedReason, onPreview }: AdditionalSettingsProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  return (
    <Disclosure title="Additional settings" open={open} onOpenChange={setOpen} keepMounted>
      <div className="additional-settings">
        <AtlasSizeSelect options={atlasSizes} value={atlasKey} onChange={onAtlasKeyChange} />
        <div className="additional-settings__render">
          <div className="additional-settings__render-select">
            <AtlasRenderSelect value={atlasRender} onChange={onAtlasRenderChange} />
          </div>
          <IconButton
            label="Preview atlas"
            icon={<Icon name="eye" size={16} />}
            loading={previewing}
            disabled={previewBlockedReason !== null}
            {...(previewBlockedReason === null ? {} : { disabledReason: previewBlockedReason })}
            onClick={onPreview}
          />
        </div>
      </div>
    </Disclosure>
  );
}
