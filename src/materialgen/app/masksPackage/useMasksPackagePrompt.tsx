import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import { downloadMasksPackage, type PackageProgress } from '../../masks/package/downloadMasksPackage';
import { MASKS_PACKAGE_BYTES } from '../../masks/package/masksPackageManifest';
import { isMasksPackageInstalled, openMasksPackageCache, type PackageCache } from '../../masks/package/masksPackageStore';
import { MasksPackageDialog, type MasksPackagePhase } from './MasksPackageDialog';

export interface MasksPackagePrompt {
  /** Resolves when the run may go on: at once with the package installed, declined or no storage; else after the user's answer and the download. Never rejects. */
  ensure(): Promise<void>;
  dialog: ReactNode;
}

interface PromptDeps {
  openCache?: () => Promise<PackageCache>;
  download?: typeof downloadMasksPackage;
  declined?: { value: boolean };
}

/** Masks-package R6: once the user cancels, the question is not asked again until the page is reloaded. */
const SESSION_DECLINED = { value: false };

/** Masks-package R6-R10: the prompt a metal-roughness run waits for, and the dialog it shows. */
export function useMasksPackagePrompt({ openCache = openMasksPackageCache, download = downloadMasksPackage, declined = SESSION_DECLINED }: PromptDeps = {}): MasksPackagePrompt {
  const [phase, setPhase] = useState<MasksPackagePhase | null>(null);
  const [progress, setProgress] = useState<PackageProgress>({ loaded: 0, total: MASKS_PACKAGE_BYTES });
  const waiting = useRef<(() => void) | null>(null);
  const downloading = useRef<AbortController | null>(null);
  const cache = useRef<PackageCache | null>(null);

  const release = useCallback(() => {
    setPhase(null);
    const resolve = waiting.current;
    waiting.current = null;
    resolve?.();
  }, []);

  useEffect(
    () => () => {
      downloading.current?.abort();
      waiting.current?.();
    },
    [],
  );

  const ensure = useCallback(async (): Promise<void> => {
    if (declined.value) return;
    try {
      cache.current = await openCache();
      if (await isMasksPackageInstalled(cache.current)) return;
    } catch {
      return; // no Cache Storage here: nothing can be stored, so the keyword match is used and nothing is asked
    }
    setProgress({ loaded: 0, total: MASKS_PACKAGE_BYTES });
    setPhase('asking');
    await new Promise<void>((resolve) => {
      waiting.current = resolve;
    });
  }, [declined, openCache]);

  const startDownload = useCallback(async () => {
    const controller = new AbortController();
    downloading.current = controller;
    setPhase('downloading');
    const outcome = await download({ cache: cache.current! }, { signal: controller.signal, onProgress: setProgress });
    if (downloading.current === controller) downloading.current = null;
    if (outcome.ok || outcome.reason === 'aborted') release();
    else setPhase('failed');
  }, [download, release]);

  const cancelQuestion = useCallback(() => {
    declined.value = true;
    release();
  }, [declined, release]);

  const cancelDownload = useCallback(() => downloading.current?.abort(), []);

  const dialog = <MasksPackageDialog phase={phase} progress={progress} onDownload={() => void startDownload()} onCancel={cancelQuestion} onCancelDownload={cancelDownload} onContinue={release} />;
  return { ensure, dialog };
}
