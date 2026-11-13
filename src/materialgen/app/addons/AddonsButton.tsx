import { exportEnvironments, useDesktopPickers } from '@shared/shell';
import { AddonsMenu } from './AddonsMenu';
import { downloadAddon } from './downloadAddon';

/** Materialgen/addons R2-R5: the top bar's Add-ons button, saving through the desktop app's Save dialog where there is one. */
export function AddonsButton(): React.JSX.Element {
  const pickers = useDesktopPickers();
  const { download: environment } = exportEnvironments(pickers);
  return <AddonsMenu download={(addon) => downloadAddon(addon, environment)} />;
}
