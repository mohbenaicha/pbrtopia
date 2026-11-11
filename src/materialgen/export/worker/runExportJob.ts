import { kindLabel, readMapPixels, type MapKind } from '@mat/workerapi';
import { buildExportZip } from '../build/buildExportZip';
import type { ExportJob, ExportWorkerReply } from './exportProtocol';

/**
 * Export R32: runs one job (decode, resample, flip, pack, encode, zip) and reports through `post`: a reply per step, then the bytes or the failure.
 * Holds no state between jobs. The worker entry calls this; tests call it directly.
 */
export async function runExportJob(job: ExportJob, post: (reply: ExportWorkerReply, transfer?: Transferable[]) => void): Promise<void> {
  const { files, exportedAt, ...input } = job;
  try {
    const result = await buildExportZip({
      ...input,
      now: () => exportedAt,
      readMap: async (kind: MapKind) => {
        const buffer = files[kind];
        if (buffer === undefined) return null;
        const pixels = await readMapPixels(new Blob([buffer]));
        if (pixels === null) throw new Error(`${kindLabel(kind, job.colorMode)}: the file cannot be read, so nothing was exported.`);
        return pixels;
      },
      onProgress: (step) => post({ type: 'progress', step }),
    });
    post({ type: 'done', bytes: result.bytes, fileName: result.fileName }, [result.bytes.buffer]);
  } catch (error) {
    post({ type: 'failed', name: error instanceof Error ? error.name : 'Error', message: error instanceof Error ? error.message : 'The export failed.' });
  }
}
