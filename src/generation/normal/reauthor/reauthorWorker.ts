import { createReauthorCache, handleReauthorJob, type ReauthorJobRequest } from './handleReauthorJob';

// normal-reauthor R11, normal-height-edit R15: the pixel work of the normal panel, off the main thread. A height picture is loaded once and kept in `cache` until `close`; a legacy request is stateless.
const cache = createReauthorCache();
self.onmessage = (event: MessageEvent<ReauthorJobRequest>): void => {
  const response = handleReauthorJob(event.data, cache);
  const transfer: Transferable[] = response.kind === 'reauthor' ? [response.pixels.rgba.buffer] : [];
  (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(response, transfer);
};
