import type { KeyVault } from '../../keys';
import type { SharedProjectStore } from '../../projects/SharedProjectStore';
import type { ImageMaxPx } from '../../projects/records/appSettingsRecord';
import { Button, Select, type SelectOption } from '../../ui-kit';
import { SettingsGroup } from './SettingsGroup';
import { SettingsPage } from './SettingsPage';
import { SettingsRow } from './SettingsRow';
import type { ModelListRefreshState } from './useModelListRefresh';
import { useImageSizeSettings } from './useImageSizeSettings';
import { useModelSettings } from './useModelSettings';

export interface ModelsSectionProps {
  store: Pick<SharedProjectStore, 'loadAppSettings' | 'saveAppSettings'>;
  vault: Pick<KeyVault, 'hasKey' | 'on'>;
  keysLoaded: boolean; // the stored vault has been read, so hasKey can be trusted
  refresh: ModelListRefreshState; // held by the Settings view, so it outlives this section
}

const NO_KEY_TEXT = 'Add a key under API keys first.';

const SIZE_OPTIONS: SelectOption[] = [2048, 1024, 512].map((px) => ({ value: String(px), label: `${px} × ${px}` }));
const ORIGINAL_SIZE = 'original';
const REFERENCE_SIZE_OPTIONS: SelectOption[] = [...SIZE_OPTIONS, { value: ORIGINAL_SIZE, label: 'Original size' }];
const toImageMaxPx = (value: string): ImageMaxPx => Number(value) as ImageMaxPx;

// Settings R5, R6, R14: the prompt-enhancer dropdown, the two image-size dropdowns and the model-list Refresh.
export function ModelsSection({ store, vault, keysLoaded, refresh }: ModelsSectionProps): React.JSX.Element {
  const models = useModelSettings(store, vault, keysLoaded, refresh.stored);
  const sizes = useImageSizeSettings(store);
  const noKey = models.keyed.length === 0;

  return (
    <SettingsPage title="Models" description="Choose the model that improves your prompts, set how large your pictures are when sent, and keep the lists of models up to date.">
      {!models.loaded || !sizes.loaded ? (
        <p role="status">Loading…</p>
      ) : (
        <>
          <SettingsGroup title="Prompt enhancer" messages={noKey && <p className="settings-note">{NO_KEY_TEXT}</p>}>
            <SettingsRow label="Prompt enhancer model" hint="Needed for material decomposition. Also improves your prompts.">
              <Select label="Prompt enhancer model" hideLabel options={models.options} value={models.value} disabled={noKey} onChange={(value) => void models.choose(value)} {...(models.saveError === null ? {} : { error: models.saveError })} />
            </SettingsRow>
            <SettingsRow label="Max image size for enhancer" hint="Smaller images save tokens.">
              <Select
                label="Max image size for enhancer"
                hideLabel
                options={SIZE_OPTIONS}
                value={String(sizes.enhancerMaxPx)}
                onChange={(value) => void sizes.chooseEnhancerMaxPx(toImageMaxPx(value))}
                {...(sizes.errors.enhancerImageMaxPx === null ? {} : { error: sizes.errors.enhancerImageMaxPx })}
              />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup title="Max reference image size">
            <SettingsRow label="Reference image size" hint="Smaller references save tokens. Original sends them as uploaded.">
              <Select
                label="Reference image size"
                hideLabel
                options={REFERENCE_SIZE_OPTIONS}
                value={sizes.referenceMaxPx === null ? ORIGINAL_SIZE : String(sizes.referenceMaxPx)}
                onChange={(value) => void sizes.chooseReferenceMaxPx(value === ORIGINAL_SIZE ? null : toImageMaxPx(value))}
                {...(sizes.errors.referenceImageMaxPx === null ? {} : { error: sizes.errors.referenceImageMaxPx })}
              />
            </SettingsRow>
          </SettingsGroup>
          <SettingsGroup
            title="Model lists"
            messages={
              <>
                {refresh.problems.length > 0 && (
                  <ul className="settings-problems">
                    {refresh.problems.map((problem) => (
                      <li key={problem}>{problem}</li>
                    ))}
                  </ul>
                )}
                {refresh.error !== null && <p role="alert">{refresh.error}</p>}
              </>
            }
            actions={
              <Button loading={refresh.refreshing} disabled={noKey} onClick={() => void refresh.start()}>
                Refresh
              </Button>
            }
          >
            <SettingsRow label="Model list" hint="Asks each service you have a key for which models it offers.">
              <span className="settings-note">{models.updatedAt === null ? 'Showing the built-in list' : `Updated ${new Date(models.updatedAt).toLocaleString()}`}</span>
            </SettingsRow>
          </SettingsGroup>
        </>
      )}
    </SettingsPage>
  );
}
