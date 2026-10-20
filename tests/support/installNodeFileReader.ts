import { vi } from 'vitest';

// three's GLTFExporter reads its binary chunk through FileReader, which Node does not have; this stands in with Blob.arrayBuffer.
class NodeFileReader {
  result: ArrayBuffer | null = null;
  onloadend: (() => void) | null = null;
  readAsArrayBuffer(blob: Blob): void {
    void blob.arrayBuffer().then((buffer) => {
      this.result = buffer;
      this.onloadend?.();
    });
  }
}

export function installNodeFileReader(): void {
  vi.stubGlobal('FileReader', NodeFileReader);
}
