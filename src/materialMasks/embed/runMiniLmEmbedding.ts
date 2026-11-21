import { createPackagedModelCache, openRuntimeAddress } from '../package/createPackagedModelCache';
import { openMasksPackageCache } from '../package/masksPackageStore';
import { createLocalModelCache } from './createLocalModelCache';

/** Where the build put each small MiniLM file (config and tokenizer), by its path inside the model folder (data/minilm). The model itself is in the downloaded package. */
const MODEL_FILES = import.meta.glob('../data/minilm/*.json', { query: '?url', import: 'default', eager: true }) as Record<string, string>;
const MODEL_ID = 'Xenova/all-MiniLM-L6-v2';

type Extractor = (text: string[], options: { pooling: 'mean'; normalize: true }) => Promise<{ data: Float32Array; dims: number[] }>;

let extractor: Promise<Extractor> | null = null;

function modelFilesByPath(): Record<string, string> {
  const marker = '/data/minilm/';
  return Object.fromEntries(Object.entries(MODEL_FILES).map(([path, url]) => [path.slice(path.indexOf(marker) + marker.length), url]));
}

async function loadExtractor(): Promise<Extractor> {
  const packageCache = await openMasksPackageCache(); // masks-package R11: only the stored package; with none, this throws and the matching uses the keywords
  const runtimeAddress = await openRuntimeAddress(packageCache);
  const { pipeline, env } = await import('@huggingface/transformers');
  env.allowLocalModels = false; // the files are found through the custom cache below, never by a path on the server
  env.allowRemoteModels = true; // needed for the custom cache to be asked at all
  env.remoteHost = 'https://models.invalid/'; // a file the cache does not hold must fail, not reach a real host (masks R73)
  env.useBrowserCache = false;
  env.useCustomCache = true;
  env.customCache = createPackagedModelCache(createLocalModelCache(modelFilesByPath()), packageCache);
  const wasm = env.backends.onnx.wasm;
  if (wasm !== undefined) wasm.wasmPaths = { wasm: runtimeAddress } as NonNullable<typeof wasm.wasmPaths>; // the stored runtime, not the CDN default (its loader script is inside the bundle)
  return (await pipeline('feature-extraction', MODEL_ID, { dtype: 'q8', device: 'wasm' })) as unknown as Extractor;
}

/**
 * Masks R73, R74: the MiniLM sentence vectors (mean pooled, unit length) of the given texts, as Materialize makes them. The model is loaded on the
 * first call of a worker. Runs only in a worker.
 */
export async function runMiniLmEmbedding(texts: string[]): Promise<Float32Array[]> {
  extractor ??= loadExtractor();
  let ready: Extractor;
  try {
    ready = await extractor;
  } catch (error) {
    extractor = null; // a later call tries again
    throw error;
  }
  if (texts.length === 0) return [];
  const output = await ready(texts, { pooling: 'mean', normalize: true });
  const size = output.dims[output.dims.length - 1]!;
  return texts.map((_, row) => output.data.slice(row * size, (row + 1) * size));
}
