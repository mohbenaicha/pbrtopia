/** One file of the masks package: where it is fetched from, how big it is and the SHA-256 it must have (masks-package R1). */
export interface PackageFile {
  id: 'model' | 'runtime';
  url: string;
  bytes: number;
  sha256: string;
}

export const MASKS_PACKAGE_FILES: readonly PackageFile[] = [
  {
    id: 'model',
    url: 'https://huggingface.co/Xenova/all-MiniLM-L6-v2/resolve/main/onnx/model_quantized.onnx',
    bytes: 22972370,
    sha256: 'afdb6f1a0e45b715d0bb9b11772f032c399babd23bfc31fed1c170afc848bdb1',
  },
  {
    id: 'runtime',
    url: 'https://cdn.jsdelivr.net/npm/onnxruntime-web@1.22.0-dev.20250409-89f8206ba4/dist/ort-wasm-simd-threaded.jsep.wasm',
    bytes: 21596019,
    sha256: 'c46655e8a94afc45338d4cb2b840475f88e5012d524509916e505079c00bfa39',
  },
];

export const MASKS_PACKAGE_BYTES = MASKS_PACKAGE_FILES.reduce((sum, file) => sum + file.bytes, 0);

/** The model's path inside its repository, which transformers.js asks the cache for (the end of the address it builds). */
export const MODEL_PATH = 'onnx/model_quantized.onnx';

/** Masks-package R5: the Cache Storage entry that holds the verified files. */
export const MASKS_PACKAGE_CACHE_NAME = 'pbrtopia-masks-package-v1';

/** Masks-package R3: the hosts the package may come from; a host matches itself and its subdomains. */
const TRUSTED_HOSTS = ['huggingface.co', 'hf.co', 'cdn.jsdelivr.net'];

/** Masks-package R3: true for an https address on one of the trusted hosts (after redirects too). */
export function isTrustedAddress(address: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    return false;
  }
  if (parsed.protocol !== 'https:') return false;
  return TRUSTED_HOSTS.some((host) => parsed.hostname === host || parsed.hostname.endsWith(`.${host}`));
}
