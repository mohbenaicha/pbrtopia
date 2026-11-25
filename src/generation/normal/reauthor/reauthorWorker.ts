import { handleReauthorJob, type ReauthorJobRequest } from './handleReauthorJob';

// normal-reauthor R11: the pixel work of one re-authoring job, off the main thread. One request in, one answer out; nothing is kept between requests.
self.onmessage = (event: MessageEvent<ReauthorJobRequest>): void => {
  const response = handleReauthorJob(event.data);
  const transfer: Transferable[] = response.kind === 'reauthor' ? [response.pixels.rgba.buffer] : [];
  (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(response, transfer);
};
