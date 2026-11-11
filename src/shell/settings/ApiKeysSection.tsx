import { KeySettingsSection, type Provider } from '../../keys';
import { useAppBackends } from '../backends/AppBackendsProvider';
import { SettingsPage } from './SettingsPage';
import type { RejectedKeyFlags } from './useKeyCheck';

interface ApiKeysSectionProps {
  rejectedKeys: RejectedKeyFlags; // settings R4: keys a provider refused after they were saved
  onKeySaved: (provider: Provider) => void;
  note?: string; // a closing line for the description (materialgen app R41: this app's own vault)
}

const DESCRIPTION = 'The keys that let the app use the image and text services. They are encrypted and stay in this browser.';

// Settings R3: the key section of api-keys, with the vault and the password question the app owns.
export function ApiKeysSection({ rejectedKeys, onKeySaved, note }: ApiKeysSectionProps): React.JSX.Element {
  const backends = useAppBackends();
  return (
    <SettingsPage title="API keys" description={note === undefined ? DESCRIPTION : `${DESCRIPTION} ${note}`}>
      <KeySettingsSection vault={backends.keys} prompt={backends.passwordPrompt} rejectedKeys={rejectedKeys} onKeySaved={onKeySaved} />
    </SettingsPage>
  );
}
