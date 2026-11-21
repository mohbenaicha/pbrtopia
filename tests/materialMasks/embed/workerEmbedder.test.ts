import { describe, expect, it } from 'vitest';
import { createWorkerEmbedder } from '@shared/materialMasks/embed/createWorkerEmbedder';
import { createLocalModelCache } from '@shared/materialMasks/embed/createLocalModelCache';
import type { WorkerJobHandle, WorkerJobReply } from '@shared/workerJob';

function fakeWorker(reply: (message: unknown) => WorkerJobReply): { handle: () => WorkerJobHandle; posted: unknown[] } {
  const posted: unknown[] = [];
  const handle = (): WorkerJobHandle => {
    const worker: WorkerJobHandle = {
      onmessage: null,
      onerror: null,
      onmessageerror: null,
      postMessage(message) {
        posted.push(message);
        queueMicrotask(() => worker.onmessage?.({ data: reply(message) }));
      },
      terminate() {},
    };
    return worker;
  };
  return { handle, posted };
}

describe('materialgen/masks createWorkerEmbedder', () => {
  it('R73 the texts go to a worker, never the page, and the vectors come back one per text', async () => {
    const worker = fakeWorker(() => ({ type: 'done', result: [Float32Array.of(1, 0), Float32Array.of(0, 1)] }));
    const embedder = createWorkerEmbedder({ createWorker: worker.handle });
    const vectors = await embedder.embed(['dark oak', 'rusty iron']);
    expect(vectors.map((vector) => Array.from(vector))).toEqual([[1, 0], [0, 1]]);
    expect(worker.posted).toEqual([{ kind: 'embed', input: { texts: ['dark oak', 'rusty iron'] } }]);
  });

  it('R77 a worker that fails rejects, so the matching falls back to keywords', async () => {
    const worker = fakeWorker(() => ({ type: 'error', message: 'model files missing', name: 'Error' }));
    await expect(createWorkerEmbedder({ createWorker: worker.handle }).embed(['oak'])).rejects.toThrow('model files missing');
  });

  it('R77 where workers do not exist the embedder rejects instead of loading the model in the page', async () => {
    await expect(createWorkerEmbedder({ createWorker: undefined }).embed(['oak'])).rejects.toThrow();
  });
});

describe('materialgen/masks createLocalModelCache', () => {
  const cache = createLocalModelCache({
    'tokenizer.json': 'blob:tokenizer',
    'onnx/model_quantized.onnx': 'blob:model',
  }, async (url) => new Response(`served ${url}`));

  it('R73 a model file asked for by its Hugging Face address is answered from the app own files, by the end of its path', async () => {
    const found = await cache.match('https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx');
    expect(await found?.text()).toBe('served blob:model');
    const tokenizer = await cache.match('https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/tokenizer.json');
    expect(await tokenizer?.text()).toBe('served blob:tokenizer');
  });

  it('R73 a file the app does not ship is not found, so nothing is taken for granted', async () => {
    expect(await cache.match('https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/special_tokens_map.json')).toBeUndefined();
  });

  it('R73 storing is a no-op: the files are already part of the app', async () => {
    await expect(cache.put('https://huggingface.co/x/tokenizer.json', new Response('x'))).resolves.toBeUndefined();
  });
});
