import { KeySettingsSection, type Provider } from '../../keys';
import { useAppBackends } from '../backends/AppBackendsProvider';
import { SettingsPage } from './SettingsPage';
import type { RejectedKeyFlags } from './useKeyCheck';

interface ApiKeysSectionProps {
  rejectedKeys: RejectedKeyFlags; // settings R4: keys a provider refused after they were saved
  onKeySaved: (provider: Provider) => void;
}

// Settings R20, api-keys R9: the one sentence about the keys; nothing else on the page repeats it.
const DESCRIPTION = 'Keys are encrypted with your password and stay in this browser; this protects them at rest only, not against XSS or a malicious extension.';
// Api-keys R22: added only where the host can read the environment.
const ENV_SENTENCE = ' Or read them from environment variables each time they are used; the app does not store them there, and any program on this computer can read them.';

// Settings R3: the key section of api-keys, with the vault and the password question the app owns.
export function ApiKeysSection({ rejectedKeys, onKeySaved }: ApiKeysSectionProps): React.JSX.Element {
  const backends = useAppBackends();
  return (
    <SettingsPage title="API keys" tutorial="settings-keys" description={backends.keys.envOffered() ? `${DESCRIPTION}${ENV_SENTENCE}` : DESCRIPTION}>
      <KeySettingsSection vault={backends.vault} prompt={backends.passwordPrompt} env={{ keys: backends.keys, choices: backends.envChoices }} rejectedKeys={rejectedKeys} onKeySaved={onKeySaved} />
    </SettingsPage>
  );
}
