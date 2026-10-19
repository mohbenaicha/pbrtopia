import { decryptSecret } from './decryptSecret';
import { encryptSecret } from './encryptSecret';
import type { SealedBytes } from './sealedBytes';

const VERIFIER_CONSTANT = 'texture-lab-keys verifier constant';
const VERIFIER_DATA = 'texture-lab-keys/v1/verifier';

// R2, R5: a known constant sealed with the derived key. Whether a password is right is decided by opening it; nothing is written.
export function makeVerifier(key: CryptoKey): Promise<SealedBytes> {
  return encryptSecret(key, VERIFIER_CONSTANT, VERIFIER_DATA);
}

export async function checkVerifier(key: CryptoKey, verifier: SealedBytes): Promise<boolean> {
  return (await decryptSecret(key, verifier, VERIFIER_DATA)) === VERIFIER_CONSTANT;
}
