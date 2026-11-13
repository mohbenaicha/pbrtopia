import addonsIconUrl from '@mat/data/integration/addons.png';
import blenderLogoUrl from '@mat/data/integration/integration_assets_logo-blender.png';
import blenderZipUrl from '@mat/data/integration/integration_blender_pbrtopia.zip?url';
import mayaLogoUrl from '@mat/data/integration/integration_assets_logo-maya.png';
import mayaZipUrl from '@mat/data/integration/integration_maya_modules.zip?url';
import substanceLogoUrl from '@mat/data/integration/integration_assets_logo-sbp.png';

// The plugins and logos that ship with the app (materialgen/addons R1): static files, the zips fetched only when downloaded.

export interface AddonEntry {
  id: 'blender' | 'maya';
  name: string;
  logoUrl: string;
  zipUrl: string;
  fileName: string; // what the zip is saved as
}

export const ADDONS: readonly AddonEntry[] = [
  { id: 'blender', name: 'Blender', logoUrl: blenderLogoUrl, zipUrl: blenderZipUrl, fileName: 'integration_blender_pbrtopia.zip' },
  { id: 'maya', name: 'Maya', logoUrl: mayaLogoUrl, zipUrl: mayaZipUrl, fileName: 'integration_maya_modules.zip' },
];

export const ADDONS_ICON_URL = addonsIconUrl;

/** The logo of an export target (materialgen/addons R6). */
export const TARGET_LOGO_URLS = { blender: blenderLogoUrl, maya: mayaLogoUrl, substance: substanceLogoUrl } as const;
