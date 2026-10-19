import { useEffect, useState } from 'react';
import { Button } from '../../ui-kit';
import type { KeyVault } from '../KeyVault';
import { PROVIDERS, type Provider } from '../vaultTypes';
import { KeyRow } from './KeyRow';
import { useVaultVersion } from './useVaultVersion';
import './keysUi.css';

export interface KeySettingsSectionProps {
  vault: KeyVault;
  rejectedKeys?: Partial<Record<Provider, string>> | undefined; // R11: providers whose stored key was refused, with the message to show
}

const LABELS: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };

// R1, R3, R6, R7, R9, R12: the "API keys" part of Settings. It reads the stored vault when it opens and follows its status after that.
export function KeySettingsSection({ vault, rejectedKeys }: KeySettingsSectionProps): React.JSX.Element {
  useVaultVersion(vault);
  const [messages, setMessages] = useState<Partial<Record<Provider, string>>>({});
  const status = vault.status();
  const [seenStatus, setSeenStatus] = useState(status);

  useEffect(() => {
    void vault.refresh();
  }, [vault]);

  // Deleting the saved keys (Forgot password) leaves old failure messages meaningless, so they go with it.
  if (status !== seenStatus) {
    setSeenStatus(status);
    if (status === 'none') setMessages({});
  }

  return (
    <section className="key-settings" aria-labelledby="key-settings-title">
      <div className="key-settings__header">
        <h3 className="key-settings__title" id="key-settings-title">API keys</h3>
        {status === 'unlocked' && <Button variant="secondary" onClick={() => vault.lock()}>Lock</Button>}
      </div>
      <p className="key-settings__note">Keys are encrypted with your password and stay in this browser.</p>
      {PROVIDERS.map((provider) => (
        <KeyRow
          key={provider}
          provider={provider}
          label={LABELS[provider]}
          vault={vault}
          message={messages[provider]}
          rejected={rejectedKeys?.[provider]}
          onMessage={(text) =>
            setMessages((current) => {
              const others = { ...current };
              delete others[provider];
              return text === null ? others : { ...others, [provider]: text };
            })
          }
        />
      ))}
      <p className="key-settings__note">
        This protects keys at rest only. It does not protect against XSS or a malicious extension, and a decrypted key is a JavaScript
        string that can stay in memory until garbage collection, even after locking.
      </p>
    </section>
  );
}
