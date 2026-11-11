import { decryptSecret } from './decryptSecret';
import { encryptSecret } from './encryptSecret';
import type { SealedBytes } from './sealedBytes';

import { vaultScope } from '../../appId';

const constantFor = (scope: string): string => `${scope} verifier constant`;
const dataFor = (scope: string): string => `${scope}/v1/verifier`;

// R2, R5: a known constant sealed with the derived key. Whether a password is right is decided by opening it; nothing is written.
// `scope` is the vault's name prefix (the default is the projection app's own), so a verifier made for one app never opens for another.
export function makeVerifier(key: CryptoKey, scope: string = vaultScope()): Promise<SealedBytes> {
  return encryptSecret(key, constantFor(scope), dataFor(scope));
}

export async function checkVerifier(key: CryptoKey, verifier: SealedBytes, scope: string = vaultScope()): Promise<boolean> {
  return (await decryptSecret(key, verifier, dataFor(scope))) === constantFor(scope);
}
