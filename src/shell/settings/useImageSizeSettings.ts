import { useCallback, useEffect, useRef, useState } from 'react';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import { DEFAULT_APP_SETTINGS, type AppSettingsRecord, type ImageMaxPx } from '../../projects/records/appSettingsRecord';

type SizeField = 'enhancerImageMaxPx' | 'referenceImageMaxPx';
type Sizes = Pick<AppSettingsRecord, SizeField>;
type Errors = Record<SizeField, string | null>;

interface ImageSizeSettingsState {
  loaded: boolean; // the saved settings have been read
  enhancerMaxPx: ImageMaxPx;
  referenceMaxPx: ImageMaxPx | null; // null = Original size
  errors: Errors; // the reason the latest save of each dropdown failed
  chooseEnhancerMaxPx(value: ImageMaxPx): Promise<void>;
  chooseReferenceMaxPx(value: ImageMaxPx | null): Promise<void>;
}

const NO_ERRORS: Errors = { enhancerImageMaxPx: null, referenceImageMaxPx: null };

/** Settings R14: the two image-size dropdowns' values from the saved settings; each choice saves at once and a failed latest save shows the stored value again. */
export function useImageSizeSettings(store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>): ImageSizeSettingsState {
  const [sizes, setSizes] = useState<Sizes | null>(null);
  const [errors, setErrors] = useState<Errors>(NO_ERRORS);
  const mounted = useRef(true);
  const stored = useRef<Sizes>({ enhancerImageMaxPx: DEFAULT_APP_SETTINGS.enhancerImageMaxPx, referenceImageMaxPx: DEFAULT_APP_SETTINGS.referenceImageMaxPx }); // the last values the store accepted (or held on load)
  const latestChoice = useRef<Record<SizeField, number>>({ enhancerImageMaxPx: 0, referenceImageMaxPx: 0 }); // numbers each dropdown's choices, so only the latest one's failure is shown

  useEffect(() => {
    mounted.current = true;
    void store.loadAppSettings().then((settings) => {
      if (!mounted.current) return;
      stored.current = { enhancerImageMaxPx: settings.enhancerImageMaxPx, referenceImageMaxPx: settings.referenceImageMaxPx };
      setSizes(stored.current);
    });
    return () => {
      mounted.current = false;
    };
  }, [store]);

  const choose = useCallback(
    async <Field extends SizeField>(field: Field, value: Sizes[Field]): Promise<void> => {
      latestChoice.current[field] += 1;
      const mine = latestChoice.current[field];
      setErrors((current) => ({ ...current, [field]: null }));
      setSizes((current) => (current === null ? current : { ...current, [field]: value }));
      const result = await store.saveAppSettings({ [field]: value });
      if (result.ok) {
        stored.current = { ...stored.current, [field]: value };
        return;
      }
      if (!mounted.current || mine !== latestChoice.current[field]) return;
      setSizes((current) => (current === null ? current : { ...current, [field]: stored.current[field] }));
      setErrors((current) => ({ ...current, [field]: result.error.message }));
    },
    [store],
  );

  const chooseEnhancerMaxPx = useCallback((value: ImageMaxPx) => choose('enhancerImageMaxPx', value), [choose]);
  const chooseReferenceMaxPx = useCallback((value: ImageMaxPx | null) => choose('referenceImageMaxPx', value), [choose]);
  return {
    loaded: sizes !== null,
    enhancerMaxPx: sizes?.enhancerImageMaxPx ?? DEFAULT_APP_SETTINGS.enhancerImageMaxPx,
    referenceMaxPx: sizes?.referenceImageMaxPx ?? DEFAULT_APP_SETTINGS.referenceImageMaxPx,
    errors,
    chooseEnhancerMaxPx,
    chooseReferenceMaxPx,
  };
}
