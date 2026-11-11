import type { MapKind } from '@mat/workerapi';
import type { BuildExportInput, ExportProgress } from '../build/buildExportZip';

/** Export R29, R32: everything the worker needs, copied out of the project at the moment Export is pressed. */
export interface ExportJob extends Omit<BuildExportInput, 'readMap' | 'onProgress' | 'signal' | 'now'> {
  exportedAt: string;
  /** The stored PNG bytes of each map the plan reads, by stored map kind. */
  files: Partial<Record<MapKind, ArrayBuffer>>;
}

export type ExportWorkerReply =
  | { type: 'progress'; step: ExportProgress }
  | { type: 'done'; bytes: Uint8Array; fileName: string }
  | { type: 'failed'; name: string; message: string };
