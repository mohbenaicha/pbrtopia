const VAULT_CHANNEL_NAME ='texture-lab-keys';

// How one tab tells the others the vault changed (R10). The message carries nothing: a tab that hears it locks and reads the record again.
export interface VaultChannel {
  postChanged(): void;
  onChanged(listener: () => void): () => void; // returns a function that stops listening
  close(): void;
}

// The BroadcastChannel-backed channel, or null in a browser without it (tabs then find out at their next save, which is refused).
export function createBroadcastVaultChannel(name: string = VAULT_CHANNEL_NAME): VaultChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  const channel = new BroadcastChannel(name);
  return {
    postChanged: () => channel.postMessage('vault-changed'),
    onChanged(listener) {
      const handler = (): void => listener();
      channel.addEventListener('message', handler);
      return () => channel.removeEventListener('message', handler);
    },
    close: () => channel.close(),
  };
}
