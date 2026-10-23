import { StoreAbort, storeFailure, type StoreError } from '../storeError';

/** Stops the importer at the first thing wrong with a zip, with a typed store error (`corrupt` unless told otherwise). */
export const reject = (message: string, code: StoreError['code'] = 'corrupt'): never => {
  throw new StoreAbort(storeFailure(code, message).error);
};

export const shorten = (name: string): string => (name.length > 60 ? `${name.slice(0, 60)}...` : name);
