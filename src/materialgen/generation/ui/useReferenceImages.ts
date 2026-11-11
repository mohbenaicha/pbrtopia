import { useCallback, useEffect, useRef, useState } from 'react';
import type { StoreResult } from '@shared/projects';
import { readImageFile, type ReferenceImage } from '@shared/generation';
import type { MaterialProjectStore, MaterialRecord } from '@mat/storage';

type ReferenceStore = Pick<MaterialProjectStore, 'readBlob' | 'writeBlob' | 'deleteBlob'>;

export interface ReferenceImages {
  references: ReferenceImage[]; // in the order added; Image 1 sends them all (R39)
  notice: string | null;
  addFiles(files: File[]): void;
  remove(id: string): void;
}

interface Inputs {
  store: ReferenceStore;
  projectId: string;
  keys: readonly string[]; // the record's referenceImages
  canWrite: boolean;
  whenSwept(): Promise<void>;
  commit(change: (record: MaterialRecord) => MaterialRecord): Promise<StoreResult<void>>;
}

const newReferenceKey = (): string => `references/${crypto.randomUUID()}`;

/** Generation R39 and the Reference images section: the project's reference images, read from its files, added and removed with the record and the file kept in step. */
export function useReferenceImages({ store, projectId, keys, canWrite, whenSwept, commit }: Inputs): ReferenceImages {
  const [references, setReferences] = useState<ReferenceImage[]>([]);
  const [notice, setNotice] = useState<string | null>(null);
  const names = useRef(new Map<string, string>()); // a picked file's own name, kept while the tab is open

  useEffect(() => {
    let current = true;
    void Promise.all(
      keys.map(async (key, index) => {
        const blob = await store.readBlob(projectId, key);
        if (blob === null) return null;
        try {
          const image = await readImageFile(new File([blob], names.current.get(key) ?? `Reference ${index + 1}`, { type: blob.type }));
          return { ...image, id: key };
        } catch {
          return null;
        }
      }),
    ).then((read) => {
      if (current) setReferences(read.filter((image): image is ReferenceImage => image !== null));
    });
    return () => {
      current = false;
    };
  }, [store, projectId, keys]);

  const addFiles = useCallback(
    (files: File[]) => {
      if (!canWrite) return;
      void (async () => {
        setNotice(null);
        await whenSwept(); // the opening sweep deletes files no record names, so a new file waits for it
        const added: string[] = [];
        const refused: string[] = [];
        for (const file of files) {
          try {
            await readImageFile(file); // refuses what the browser cannot decode
          } catch {
            refused.push(file.name);
            continue;
          }
          const key = newReferenceKey();
          const written = await store.writeBlob(projectId, key, file);
          if (!written.ok) {
            refused.push(file.name);
            continue;
          }
          names.current.set(key, file.name);
          added.push(key);
        }
        if (added.length > 0) {
          const stored = await commit((record) => ({ ...record, referenceImages: [...record.referenceImages, ...added] }));
          if (!stored.ok) {
            await Promise.all(added.map((key) => store.deleteBlob(projectId, key)));
            setNotice('The reference images could not be saved.');
            return;
          }
        }
        if (refused.length > 0) setNotice(`Could not add ${refused.join(', ')}.`);
      })();
    },
    [canWrite, store, projectId, whenSwept, commit],
  );

  const remove = useCallback(
    (id: string) => {
      if (!canWrite) return;
      void (async () => {
        const stored = await commit((record) => ({ ...record, referenceImages: record.referenceImages.filter((key) => key !== id) }));
        if (stored.ok) await store.deleteBlob(projectId, id);
      })();
    },
    [canWrite, store, projectId, commit],
  );

  return { references, notice, addFiles, remove };
}
