import { SALT_BYTES } from './sealedBytes';

// R2: the vault's salt, made once when the vault is created.
export function createSalt(): Uint8Array {
  return crypto.getRandomValues(new Uint8Array(SALT_BYTES));
}
