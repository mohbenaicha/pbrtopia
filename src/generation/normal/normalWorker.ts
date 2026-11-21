import { handleNormalWork, type NormalWorkRequest } from './handleNormalWork';

// normal-map R20: the pixel work of a normal-map run, off the main thread. One request in, one answer out; nothing is kept between requests.
self.onmessage = (event: MessageEvent<NormalWorkRequest>): void => {
  const response = handleNormalWork(event.data);
  const transfer: Transferable[] = [];
  if (response.kind === 'finish') transfer.push(response.normals.rgba.buffer);
  else if (response.result.ok) transfer.push(response.result.value.picture.rgba.buffer);
  (self as unknown as { postMessage: (message: unknown, transfer: Transferable[]) => void }).postMessage(response, transfer);
};
