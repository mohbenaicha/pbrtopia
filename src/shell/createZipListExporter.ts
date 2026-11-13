import type { ExportTarget, ListExportResult, ProjectListExporter, StoreResult } from '../projects';
import { saveZipFile, zipFileName, type DownloadEnvironment } from './saveZipFile';
import { openZipBatchWriter, type FolderEnvironment } from './saveZipsToFolder';

/** What an app says about its zip for the shared list (app/projects R16, R17). */
export interface ZipListExportSource<T> {
  extension: string; // `zip`, `texturelab.zip`
  description: string; // the save picker's file description
  write(project: ExportTarget, sink: WritableStream<Uint8Array>): Promise<StoreResult<T>>;
  whenCancelled: T; // the outcome `write` can never return as a new value: the save picker closing is told apart by this very object
  describe(outcome: T): string | null; // the note after a finished export, null for none
}

const finished = <T>(result: StoreResult<T>, source: ZipListExportSource<T>): ListExportResult =>
  result.ok ? (result.value === source.whenCancelled ? { kind: 'cancelled' } : { kind: 'done', note: source.describe(result.value) }) : { kind: 'failed', message: result.error.message };

/** Builds the list's exporter over an app's zip: one project through the save picker, a batch into one folder (or as links). The environments are replaceable for tests. */
export function createZipListExporter<T>(source: ZipListExportSource<T>, environments: { download?: DownloadEnvironment; folder?: FolderEnvironment } = {}): ProjectListExporter {
  return {
    async exportOne(project) {
      const result = await saveZipFile(zipFileName(project.name, source.extension), source.description, (sink) => source.write(project, sink), source.whenCancelled, environments.download);
      return finished(result, source);
    },
    async openBatch() {
      const writer = await openZipBatchWriter(environments.folder);
      if (writer === null) return null;
      return {
        toFolder: writer.toFolder,
        async exportInto(project) {
          const saved = await writer.save(zipFileName(project.name, source.extension), (sink) => source.write(project, sink));
          const result = finished(saved, source);
          return result.kind === 'failed' && !saved.ok && 'stopBatch' in saved ? { ...result, stopBatch: true } : result;
        },
      };
    },
  };
}
