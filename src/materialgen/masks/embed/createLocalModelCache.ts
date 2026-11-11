/** The two methods of the Web Cache API that transformers.js calls on a custom cache. */
export interface ModelFileCache {
  match(key: string): Promise<Response | undefined>;
  put(key: string, response: Response): Promise<void>;
}

/**
 * Masks R73: lets transformers.js find the MiniLM files among the app's own files. It asks its cache for a file by the model-hub address
 * (`.../resolve/main/onnx/model_quantized.onnx`); the file whose path (`onnx/model_quantized.onnx`) ends that address is read from the app, so nothing is
 * fetched from the hub. A file the app does not ship is not found. Storing does nothing: the files are already part of the app.
 * `files` maps a path inside the model folder to the address the build gave the file.
 */
export function createLocalModelCache(files: Readonly<Record<string, string>>, fetchFile: (url: string) => Promise<Response> = (url) => fetch(url)): ModelFileCache {
  const longestFirst = Object.keys(files).sort((a, b) => b.length - a.length);
  return {
    async match(key) {
      const path = longestFirst.find((candidate) => key === candidate || key.endsWith(`/${candidate}`));
      return path === undefined ? undefined : fetchFile(files[path]!);
    },
    async put() {},
  };
}
