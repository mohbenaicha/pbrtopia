import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useMemo } from 'react';
import { KeyVault } from '../../../src/keys/KeyVault';
import { KeyPasswordPrompts } from '../../../src/keys/ui/KeyPasswordPrompts';
import { KeySettingsSection } from '../../../src/keys/ui/KeySettingsSection';
import { usePasswordPrompt } from '../../../src/keys/ui/usePasswordPrompt';
import type { Provider } from '../../../src/keys/vaultTypes';
import { createMemoryVaultStorage } from '../memoryVaultStorage';

export const PASSWORD = 'a long enough password';
export const GEMINI = 'AIzaSyGEMINI-0123456789-abcdWXYZ';
export const OPENAI = 'sk-proj-OPENAI-0123456789-efghQRST';

type Storage = ReturnType<typeof createMemoryVaultStorage>;

// The settings section and the password dialogs wired to one real KeyVault on an in-memory storage, as the app wires them.
export function renderKeys(options: { storage?: Storage; rejectedKeys?: Partial<Record<Provider, string>> } = {}) {
  const storage = options.storage ?? createMemoryVaultStorage();
  let vault!: KeyVault;
  function Wired(): React.JSX.Element {
    const prompt = usePasswordPrompt();
    vault = useMemo(() => new KeyVault({ storage, requestPassword: prompt.requestPassword, kdfIterations: 1000, channel: null }), [prompt.requestPassword]);
    return (
      <>
        <KeySettingsSection vault={vault} prompt={prompt} {...(options.rejectedKeys ? { rejectedKeys: options.rejectedKeys } : {})} />
        <KeyPasswordPrompts vault={vault} prompt={prompt} />
      </>
    );
  }
  const view = render(<Wired />);
  return { ...view, storage, user: userEvent.setup(), getVault: () => vault };
}
