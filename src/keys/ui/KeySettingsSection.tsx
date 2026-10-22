import { useEffect, useState } from 'react';
import { Button } from '../../ui-kit';
import type { KeyVault } from '../KeyVault';
import { PROVIDERS, type Provider } from '../vaultTypes';
import { KeyRow } from './KeyRow';
import { ResetSavedKeys } from './ResetSavedKeys';
import { useDeleteSavedKeys } from './useDeleteSavedKeys';
import type { PasswordPromptControls } from './usePasswordPrompt';
import { useVaultVersion } from './useVaultVersion';
import './keysUi.css';

export interface KeySettingsSectionProps {
  vault: KeyVault;
  prompt: PasswordPromptControls; // the password question the vault asks through; Reset cancels it before deleting
  rejectedKeys?: Partial<Record<Provider, string>> | undefined; // R11: providers whose stored key was refused, with the message to show
  onKeySaved?: ((provider: Provider) => void) | undefined; // after a key was saved or replaced (settings R3); the app checks it (R11)
}

const LABELS: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };

// R1, R3, R6, R7, R9, R12: the "API keys" part of Settings. It reads the stored vault when it opens and follows its status after that.
export function KeySettingsSection({ vault, prompt, rejectedKeys, onKeySaved }: KeySettingsSectionProps): React.JSX.Element {
  useVaultVersion(vault);
  const [messages, setMessages] = useState<Partial<Record<Provider, string>>>({});
  const deletion = useDeleteSavedKeys(vault, prompt);
  const status = vault.status();
  const problem = vault.loadProblem();
  const [seenStatus, setSeenStatus] = useState(status);
  const [seenProblem, setSeenProblem] = useState(problem);

  useEffect(() => {
    void vault.refresh();
  }, [vault]);

  // Deleting the saved keys (Forgot password, Reset) leaves old failure messages meaningless, so they go with it. A reset starts and
  // ends with no vault, so it is seen by the unreadable-vault message going away.
  if (status !== seenStatus || problem !== seenProblem) {
    setSeenStatus(status);
    setSeenProblem(problem);
    if (status === 'none' && (status !== seenStatus || (seenProblem !== null && problem === null))) setMessages({});
  }

  return (
    <section className="key-settings" aria-labelledby="key-settings-title">
      <div className="key-settings__header">
        <h3 className="key-settings__title" id="key-settings-title">API keys</h3>
        {status === 'unlocked' && <Button variant="secondary" onClick={() => vault.lock()}>Lock</Button>}
      </div>
      <p className="key-settings__note">Keys are encrypted with your password and stay in this browser.</p>
      {(problem !== null || deletion.deleting || deletion.failure !== null) && <ResetSavedKeys problem={problem} deletion={deletion} />}
      {PROVIDERS.map((provider) => (
        <KeyRow
          key={provider}
          provider={provider}
          label={LABELS[provider]}
          vault={vault}
          message={messages[provider]}
          rejected={rejectedKeys?.[provider]}
          onKeySaved={() => onKeySaved?.(provider)}
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
