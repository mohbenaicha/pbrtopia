import type { ReauthorParams } from '../../normalRecipe/reauthorParams';
import type { RunError } from '../generateStore';
import type { Result } from '../providers/providerTypes';
import type { NormalWorkRequest, NormalWorkResponse } from './handleNormalWork';
import type { PixelPicture, UprightSheet, UvMesh } from './uprightTypes';

export interface NormalWorkerLike {
  onmessage: ((event: { data: unknown }) => void) | null;
  onerror: ((event: { message: string }) => void) | null;
  onmessageerror: ((event: unknown) => void) | null;
  postMessage: (message: NormalWorkRequest) => void;
  terminate: () => void;
}

/** What the run needs from the pixel work: build the sheet, then turn the height map into normals in the albedo's layout. */
export interface NormalWork {
  prepare: (source: PixelPicture, mesh: UvMesh, signal: AbortSignal) => Promise<Result<UprightSheet, RunError>>;
  finish: (height: PixelPicture, sheet: UprightSheet, signal: AbortSignal) => Promise<PixelPicture>;
  /** normal-reauthor R17: the normals as the picture a new run stores (the base at the given params). */
  reauthor: (base: PixelPicture, mesh: UvMesh, params: ReauthorParams, signal: AbortSignal) => Promise<PixelPicture>;
}

const abortError = (signal: AbortSignal): unknown => signal.reason ?? new DOMException('Aborted', 'AbortError');

// One fresh worker per request: it is stateless, and aborting ends it so a late answer can never arrive.
function ask(createWorker: () => NormalWorkerLike, request: NormalWorkRequest, signal: AbortSignal): Promise<NormalWorkResponse> {
  return new Promise((resolve, reject) => {
    if (signal.aborted) {
      reject(abortError(signal));
      return;
    }
    const worker = createWorker();
    const end = (): void => {
      signal.removeEventListener('abort', onAbort);
      worker.terminate();
    };
    const onAbort = (): void => {
      end();
      reject(abortError(signal));
    };
    signal.addEventListener('abort', onAbort, { once: true });
    worker.onmessage = (event) => {
      end();
      resolve(event.data as NormalWorkResponse);
    };
    worker.onerror = (event) => {
      end();
      reject(new Error(event.message));
    };
    worker.onmessageerror = () => {
      end();
      reject(new Error('The island worker sent an answer that could not be read.'));
    };
    try {
      worker.postMessage(request);
    } catch (error) {
      end();
      reject(error);
    }
  });
}

// The finish step reads only the sheet's layout and side (R18-R19), so its pixels are not sent a second time.
function withoutSheetPixels(sheet: UprightSheet): UprightSheet {
  return { ...sheet, picture: { side: sheet.picture.side, rgba: new Uint8ClampedArray(0) } };
}

export function createNormalWork(createWorker: () => NormalWorkerLike): NormalWork {
  return {
    prepare: async (source, mesh, signal) => {
      const response = await ask(createWorker, { kind: 'prepare', source, mesh }, signal);
      if (response.kind !== 'prepare') throw new Error('The island worker answered the wrong request.');
      return response.result;
    },
    finish: async (height, sheet, signal) => {
      const response = await ask(createWorker, { kind: 'finish', height, sheet: withoutSheetPixels(sheet) }, signal);
      if (response.kind !== 'finish') throw new Error('The island worker answered the wrong request.');
      return response.normals;
    },
    reauthor: async (base, mesh, params, signal) => {
      const response = await ask(createWorker, { kind: 'reauthor', base, mesh, params }, signal);
      if (response.kind !== 'reauthor') throw new Error('The island worker answered the wrong request.');
      return response.pixels;
    },
  };
}

export const createBrowserNormalWork = (): NormalWork =>
  createNormalWork(() => new Worker(new URL('./normalWorker.ts', import.meta.url), { type: 'module' }) as unknown as NormalWorkerLike);
