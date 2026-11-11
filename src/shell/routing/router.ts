import { isSafeProjectId } from '../../projects/storage/BlobStore';

export type Route<Section extends string = string> = { view: 'list' } | { view: 'project'; id: string } | { view: 'settings'; section: Section };

export const listHash = (): string => '#/projects';
export const projectHash = (id: string): string => `#/p/${encodeURIComponent(id)}`;

const LIST: Route<never> = { view: 'list' };

function decodePart(part: string): string | null {
  try {
    return decodeURIComponent(part);
  } catch {
    return null; // bad percent-encoding
  }
}

function decodeProjectId(part: string): string | null {
  const id = decodePart(part);
  return id !== null && isSafeProjectId(id) ? id : null;
}

export type AddressKind = 'start' | 'list' | 'project' | 'settings' | 'unknown';

function splitAddress(hash: string): string[] | null {
  const path = hash.startsWith('#') ? hash.slice(1) : hash;
  if (!path.startsWith('/')) return path === '' ? [''] : null;
  return path.slice(1).replace(/\/$/, '').split('/');
}

export interface Router<Section extends string> {
  settingsHash(section: Section): string;
  /** What an address is: the bare start address, one of the three views, or something the app cannot use. */
  classifyAddress(hash: string): AddressKind;
  /** The route an address stands for; anything it cannot read is the list, and an unnamed or unknown settings section is the first one. */
  parseHash(hash: string): Route<Section>;
  /** Reports the route each time the address hash changes; returns a function that stops reporting. */
  watchRoute(target: Pick<Window, 'location' | 'addEventListener' | 'removeEventListener'>, onRoute: (route: Route<Section>) => void): () => void;
}

/** The address scheme of an app whose settings view has the given sections (the first one is the default). Views: `#/projects`, `#/p/<id>`, `#/settings/<section>`. */
export function createRouter<Section extends string>(sections: readonly [Section, ...Section[]]): Router<Section> {
  const settingsHash = (section: Section): string => `#/settings/${section}`;

  function classifyAddress(hash: string): AddressKind {
    const parts = splitAddress(hash);
    if (parts === null) return 'unknown';
    if (parts.length === 1 && parts[0] === '') return 'start';
    if (parts[0] === 'projects' && parts.length === 1) return 'list';
    if (parts[0] === 'p' && parts.length === 2) return decodeProjectId(parts[1] ?? '') === null ? 'unknown' : 'project';
    if (parts[0] === 'settings' && parts.length <= 2) return decodePart(parts[1] ?? '') === null ? 'unknown' : 'settings';
    return 'unknown';
  }

  function parseHash(hash: string): Route<Section> {
    const parts = splitAddress(hash);
    if (parts === null) return LIST;
    if (parts[0] === 'p' && parts.length === 2) {
      const id = decodeProjectId(parts[1] ?? '');
      return id === null ? LIST : { view: 'project', id };
    }
    if (parts[0] === 'settings' && parts.length <= 2) {
      const name = decodePart(parts[1] ?? '');
      if (name === null) return LIST;
      return { view: 'settings', section: sections.find((known) => known === name) ?? sections[0] };
    }
    return LIST;
  }

  function watchRoute(target: Pick<Window, 'location' | 'addEventListener' | 'removeEventListener'>, onRoute: (route: Route<Section>) => void): () => void {
    const listener = (): void => onRoute(parseHash(target.location.hash));
    target.addEventListener('hashchange', listener);
    return () => target.removeEventListener('hashchange', listener);
  }

  return { settingsHash, classifyAddress, parseHash, watchRoute };
}
