import { useState, type CSSProperties } from 'react';
import { IconButton, Popover, Spinner, Tooltip } from '@shared/ui-kit';
import type { StoreResult } from '@shared/projects';
import { ADDONS, ADDONS_ICON_URL, type AddonEntry } from './addonFiles';
import './addonsMenu.css';

interface AddonsMenuProps {
  download: (addon: AddonEntry) => Promise<StoreResult<void>>;
  addons?: readonly AddonEntry[];
}

const ICON_STYLE = { '--icon-url': `url(${ADDONS_ICON_URL})`, '--icon-size': '26px' } as CSSProperties;

/** Materialgen/addons R2-R5: the Add-ons button of the top bar and its popover with a download for each plugin. */
export function AddonsMenu({ download, addons = ADDONS }: AddonsMenuProps): React.JSX.Element {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [failure, setFailure] = useState<string | null>(null);

  const start = async (addon: AddonEntry): Promise<void> => {
    if (busy !== null) return;
    setBusy(addon.id);
    setFailure(null);
    const result = await download(addon).catch(() => ({ ok: false as const, error: { message: `The ${addon.name} add-on could not be downloaded.` } }));
    setBusy(null);
    if (!result.ok) setFailure(result.error.message);
  };

  const trigger = (
    <IconButton testId="addons" label="Add-ons" icon={<span className="ui-icon ui-icon--image" aria-hidden="true" style={ICON_STYLE} />} expanded={open} onClick={() => setOpen(!open)} />
  );
  return (
    <Popover open={open} onClose={() => setOpen(false)} label="Add-ons" trigger={trigger}>
      <div className="addons-menu">
        <div className="addons-menu__items">
          {addons.map((addon) => (
            <Tooltip key={addon.id} heading={addon.name} text="Downloads this add-on.">
              <button type="button" className="addons-menu__item" aria-label={`Download the ${addon.name} add-on`} onClick={() => void start(addon)}>
                <span className="addons-menu__logo">
                  <img src={addon.logoUrl} alt="" />
                  <span className="addons-menu__arrow" aria-hidden="true">{busy === addon.id ? <Spinner decorative /> : '↓'}</span>
                </span>
                <span>{addon.name}</span>
              </button>
            </Tooltip>
          ))}
        </div>
        {failure !== null && <p role="alert" className="addons-menu__failure">{failure}</p>}
      </div>
    </Popover>
  );
}
