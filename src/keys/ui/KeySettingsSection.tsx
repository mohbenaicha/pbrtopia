import { useEffect, useState } from 'react';
import { Button, Toggle, Tooltip } from '../../ui-kit';
import type { EnvKeyChoices } from '../env/EnvKeyChoices';
import type { KeyVault } from '../KeyVault';
import type { ProviderKeySource } from '../ProviderKeySource';
import { PROVIDERS, type Provider } from '../vaultTypes';
import { EnvKeyRow } from './EnvKeyRow';
import { KeyRow } from './KeyRow';
import { ResetSavedKeys } from './ResetSavedKeys';
import { useDeleteSavedKeys } from './useDeleteSavedKeys';
import type { PasswordPromptControls } from './usePasswordPrompt';
import { useVaultVersion } from './useVaultVersion';
import './keysUi.css';

interface KeySettingsSectionProps {
  vault: KeyVault;
  prompt: PasswordPromptControls; // the password question the vault asks through; Reset cancels it before deleting
  env?: { keys: ProviderKeySource; choices: EnvKeyChoices } | undefined; // R13: where environment keys are possible; none = the section is the pasted keys alone
  rejectedKeys?: Partial<Record<Provider, string>> | undefined; // R11: providers whose stored key was refused, with the message to show
  onKeySaved?: ((provider: Provider) => void) | undefined; // after a key was saved or replaced (settings R3); the app checks it (R11)
}

const LABELS: Record<Provider, string> = { gemini: 'Gemini', openai: 'OpenAI' };
const EXAMPLE_NAMES: Record<Provider, string> = { gemini: 'GEMINI_API_KEY', openai: 'OPENAI_API_KEY' };

// R1, R3, R6, R7, R9, R12, R13, R24: the "API keys" part of Settings. It reads the stored vault when it opens and follows its status (and the environment switch) after that.
export function KeySettingsSection({ vault, prompt, env, rejectedKeys, onKeySaved }: KeySettingsSectionProps): React.JSX.Element {
  useVaultVersion(env?.keys ?? vault);
  const envOn = env !== undefined && env.choices.enabled();
  const envOffered = env !== undefined && env.keys.envOffered();
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
        <Tooltip heading="API keys" text="The keys that let the app use the image model providers."><h3 className="key-settings__title" id="key-settings-title">API keys</h3></Tooltip>
        <div className="key-settings__header-actions">
          {env !== undefined && (envOffered || envOn) && (
            <Toggle label="Read keys from environment" tutorial="settings-env" checked={envOn} onChange={(on) => env.choices.setEnabled(on)} hint="Reads each key from a Windows environment variable every time it is used, so the app never stores it." />
          )}
          {status === 'unlocked' && <Button variant="secondary" onClick={() => vault.lock()}>Lock</Button>}
        </div>
      </div>
      {(problem !== null || deletion.deleting || deletion.failure !== null) && <ResetSavedKeys problem={problem} deletion={deletion} />}
      {envOn && !envOffered && <p className="key-settings__note">Environment keys are not available here.</p>}
      {(!envOn || envOffered) && PROVIDERS.map((provider) => {
        const common = {
          provider,
          label: LABELS[provider],
          message: messages[provider],
          rejected: rejectedKeys?.[provider],
          onKeySaved: () => onKeySaved?.(provider),
          onMessage: (text: string | null) =>
            setMessages((current) => {
              const others = { ...current };
              delete others[provider];
              return text === null ? others : { ...others, [provider]: text };
            }),
        };
        return envOn && env !== undefined ? (
          <EnvKeyRow key={provider} {...common} example={EXAMPLE_NAMES[provider]} keys={env.keys} choices={env.choices} />
        ) : (
          <KeyRow key={provider} {...common} vault={vault} />
        );
      })}
    </section>
  );
}
