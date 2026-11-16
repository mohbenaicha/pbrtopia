import { createBroadcastVaultChannel, type VaultChannel } from '../vaultChannel';

/** Api-keys R19, R10: how one tab tells the others the switch or a name changed; its own channel, next to the vault's. Null where BroadcastChannel is missing. */
export function createEnvChoiceChannel(appId: string = 'texture-lab'): VaultChannel | null {
  return createBroadcastVaultChannel(`${appId}-key-sources`);
}
