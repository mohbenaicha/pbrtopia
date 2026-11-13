/** Why a call to the desktop side failed; the backend maps these to store errors (storage-backends R9). */
export type BridgeErrorKind = 'no-space' | 'denied' | 'missing-root' | 'busy' | 'io';

export class BridgeError extends Error {
  readonly kind: BridgeErrorKind;

  constructor(kind: BridgeErrorKind, message: string) {
    super(message);
    this.name = 'BridgeError';
    this.kind = kind;
  }
}
