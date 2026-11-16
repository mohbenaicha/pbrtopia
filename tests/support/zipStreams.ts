/** A byte sink that keeps what is written to it, optionally failing on the nth write. */
export function collectingSink(options: { failOnWrite?: number } = {}): { sink: WritableStream<Uint8Array>; bytes(): Uint8Array; writes(): number } {
  const chunks: Uint8Array[] = [];
  let writes = 0;
  const sink = new WritableStream<Uint8Array>({
    write(chunk) {
      writes += 1;
      if (writes === options.failOnWrite) throw new Error('disk full');
      chunks.push(chunk.slice());
    },
  });
  return {
    sink,
    writes: () => writes,
    bytes() {
      const out = new Uint8Array(chunks.reduce((sum, chunk) => sum + chunk.length, 0));
      let at = 0;
      for (const chunk of chunks) {
        out.set(chunk, at);
        at += chunk.length;
      }
      return out;
    },
  };
}

/** A stream that hands out the bytes in pieces of `pieceSize`. */
export function streamOf(data: Uint8Array, pieceSize = 4096): ReadableStream<Uint8Array> {
  let at = 0;
  return new ReadableStream<Uint8Array>({
    pull(controller) {
      if (at >= data.length) return controller.close();
      controller.enqueue(data.slice(at, at + pieceSize));
      at += pieceSize;
    },
  });
}
