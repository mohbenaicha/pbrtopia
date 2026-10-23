import { storeFailure, type StoreError } from '../storeError';

/** Thrown inside the importer to stop at the first thing wrong with a zip; carries the typed store error. */
export class Rejection extends Error {
  constructor(readonly storeError: StoreError) {
    super(storeError.message);
  }
}

export const reject = (message: string, code: StoreError['code'] = 'corrupt'): never => {
  throw new Rejection(storeFailure(code, message).error);
};

export const shorten = (name: string): string => (name.length > 60 ? `${name.slice(0, 60)}...` : name);
