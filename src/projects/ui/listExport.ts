/** The project a list export is about. */
export interface ExportTarget {
  id: string;
  name: string;
}

/** What exporting one project ended in (app/projects R16): written (with the app's note, if any), the save picker closed, or failed with the reason to show. */
export type ListExportResult =
  | { kind: 'done'; note: string | null }
  | { kind: 'cancelled' }
  | { kind: 'failed'; message: string; stopBatch?: true }; // stopBatch: the destination refuses writes, so the rest of a batch is not tried

/** One batch of exports (R17): the destination is chosen once. `toFolder` is false where the zips go out as downloaded links. */
export interface ListExportBatch {
  toFolder: boolean;
  exportInto(project: ExportTarget): Promise<ListExportResult>;
}

/** What an app gives the shared list so its cards can export (R16, R17). */
export interface ProjectListExporter {
  exportOne(project: ExportTarget): Promise<ListExportResult>;
  /** Asks where the batch goes; null when the user closed that question, so nothing is exported. */
  openBatch(): Promise<ListExportBatch | null>;
}
