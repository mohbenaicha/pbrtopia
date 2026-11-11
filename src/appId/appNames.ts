// The names under which an app keeps its data in the browser. With no appId they are the projection app's
// historical names, unchanged; with an appId every one carries it, so two apps on one origin never share data.

const APP_ID_RULE = /^[A-Za-z][A-Za-z0-9-]{0,31}$/;
const APP_ID_MESSAGE = 'appId must be 1 to 32 letters, digits or hyphens, starting with a letter.';

export interface ProjectStoreNames {
  database: string;
  folder: string; // the OPFS root folder
  zipApp: string; // the `app` field of a project zip's manifest
  foreignZipMessage: string;
  lockName(projectId: string): string;
}

export function validateAppId(appId: string): void {
  if (!APP_ID_RULE.test(appId)) throw new Error(APP_ID_MESSAGE);
}

export function projectStoreNames(appId?: string): ProjectStoreNames {
  if (appId === undefined) {
    return {
      database: 'projects',
      folder: 'projects',
      zipApp: 'texture-lab',
      foreignZipMessage: 'This zip was not made by Texture Lab.',
      lockName: (projectId) => `project:${projectId}`,
    };
  }
  validateAppId(appId);
  return {
    database: `app-${appId}-projects`,
    folder: `app-${appId}-projects`,
    zipApp: `app-${appId}`,
    foreignZipMessage: 'This zip was not made by this app.',
    lockName: (projectId) => `${appId}:project:${projectId}`,
  };
}

/** The prefix of the key vault's database, channel and sealed-data labels. */
export function vaultScope(appId?: string): string {
  if (appId === undefined) return 'texture-lab-keys';
  validateAppId(appId);
  return `app-${appId}-keys`;
}
