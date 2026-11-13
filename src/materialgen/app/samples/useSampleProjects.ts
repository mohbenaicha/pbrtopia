import { useEffect, useRef, useState } from 'react';
import { importMaterialZip, type MaterialImportTarget, type MaterialProjectStore } from '@mat/storage';
import { BUNDLED_SAMPLES } from '@mat/samples/bundledSamples';
import { seedSampleProjects, type SampleSource } from '@mat/samples/seedSampleProjects';
import { APP_ID } from '../appIdentity';
import { estimateFreeBytes } from '../project/estimateFreeBytes';

type SampleStore = MaterialImportTarget & Pick<MaterialProjectStore, 'loadAppSettings' | 'saveAppSettings'>;

export interface SampleProjectsState {
  checked: boolean; // the flag has been read; until then the list is not shown, so the empty state never flashes
  remaining: number; // samples still to come, shown as placeholder cards
  refresh: number; // changes after every sample, so the list reads again
  failures: string[];
}

/** Materialgen/default-projects R11, R12: at the first start of the app, imports the bundled samples one by one and tells the list how many are still coming. */
export function useSampleProjects(store: SampleStore, samples: readonly SampleSource[] = BUNDLED_SAMPLES): SampleProjectsState {
  const [state, setState] = useState<SampleProjectsState>({ checked: false, remaining: 0, refresh: 0, failures: [] });
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;
    void (async () => {
      const seeded = (await store.loadAppSettings()).samplesLoaded;
      setState({ checked: true, remaining: seeded ? 0 : samples.length, refresh: 0, failures: [] });
      if (seeded) return;
      const outcome = await seedSampleProjects(
        {
          isSeeded: async () => (await store.loadAppSettings()).samplesLoaded,
          markSeeded: () => store.saveAppSettings({ samplesLoaded: true }),
          samples,
          importZip: (zip) => importMaterialZip(store, zip, undefined, { appId: APP_ID, estimateFreeBytes }),
        },
        (remaining) => setState((current) => ({ ...current, remaining, refresh: current.refresh + 1 })),
      );
      setState((current) => ({ ...current, remaining: 0, failures: outcome.failures }));
    })();
  }, [store, samples]);

  return state;
}
