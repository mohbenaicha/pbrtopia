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

// Settings R3: the key section of api-keys, with the vault and the password question the app owns.
export function ApiKeysSection({ rejectedKeys, onKeySaved }: ApiKeysSectionProps): React.JSX.Element {
  const backends = useAppBackends();
  return (
    <SettingsPage title="API keys" description={DESCRIPTION}>
      <KeySettingsSection vault={backends.keys} prompt={backends.passwordPrompt} rejectedKeys={rejectedKeys} onKeySaved={onKeySaved} />
    </SettingsPage>
  );
}
