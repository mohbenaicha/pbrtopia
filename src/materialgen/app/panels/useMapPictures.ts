import { useEffect, useRef, useState } from 'react';
import type { CompareSource } from '@shared/ui-kit';

export interface StoredPicture {
  src: string | null; // null while the file is being read
  failed: boolean;
}

/** A stored file as an object URL, made when the key is first given and released when it changes or the caller goes away (maps R46, R53). */
export function useStoredPicture(key: string | null, readBlob: (key: string) => Promise<Blob | null>): StoredPicture {
  const read = useRef(readBlob);
  read.current = readBlob;
  const [picture, setPicture] = useState<{ key: string; src: string | null }>({ key: '', src: null });
  useEffect(() => {
    if (key === null) return undefined;
    let url: string | null = null;
    let cancelled = false;
    void read.current(key).catch(() => null).then((blob) => {
      if (cancelled) return;
      url = blob === null ? null : URL.createObjectURL(blob);
      setPicture({ key, src: url });
    });
    return () => {
      cancelled = true;
      if (url !== null) URL.revokeObjectURL(url);
    };
  }, [key]);
  const ready = picture.key === key;
  return { src: ready ? picture.src : null, failed: key !== null && ready && picture.src === null };
}

/**
 * Imageops R50: the two sides of the reveal. Before is the map as it is now; After is the open session's preview (until the first one is drawn it
 * shows the same picture as Before).
 */
export function useBeforeAfterSources(workingKey: string, readBlob: (key: string) => Promise<Blob | null>, preview: { src: string | null }): CompareSource[] {
  const before = useStoredPicture(workingKey, readBlob);
  return [
    { id: 'before', label: 'Before', ...before },
    { id: 'after', label: 'After', src: preview.src ?? before.src, failed: false },
  ];
}
