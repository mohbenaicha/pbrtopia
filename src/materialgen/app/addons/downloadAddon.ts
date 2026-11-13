import { saveZipFile, type DownloadEnvironment } from '@shared/shell';
import { storeFailure, type StoreResult } from '@shared/projects';
import type { AddonEntry } from './addonFiles';

/** Materialgen/addons R5: fetches the plugin's zip now (the browser and Cloudflare cache it) and saves it under its own name, through the project export's save path. */
export function downloadAddon(addon: AddonEntry, environment?: DownloadEnvironment, fetchFile: typeof fetch = fetch): Promise<StoreResult<void>> {
  return saveZipFile(
    addon.fileName,
    `${addon.name} add-on`,
    async (sink) => {
      try {
        const response = await fetchFile(addon.zipUrl);
        if (!response.ok || response.body === null) return storeFailure('aborted', `The ${addon.name} add-on could not be downloaded.`);
        await response.body.pipeTo(sink);
        return { ok: true, value: undefined };
      } catch {
        return storeFailure('aborted', `The ${addon.name} add-on could not be downloaded.`);
      }
    },
    undefined,
    environment,
  );
}
