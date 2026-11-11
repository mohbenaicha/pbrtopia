import { MAX_PROJECT_NAME_LENGTH, describeFailure, findChecksumProblem, hasEndRecord, readZipEntries, storeFailure, type StoreError, type StoreResult } from '@shared/projects';
import type { MaterialRecord } from '../materialRecord';
import { createMaterialZipEntryProcessor, type MaterialImportTarget } from './processMaterialZipEntry';

const IMPORTED_SUFFIX = ' (imported)';

interface ImportOptions {
  appId: string; // only a zip made by this app is accepted
  newId?: () => string; // for the fresh id of the project; a uuid by default
  estimateFreeBytes?: () => Promise<number | null>; // free space for the quota check (app R36); none means no check
}

async function nameFreeIn(store: Pick<MaterialImportTarget, 'listProjects'>, name: string): Promise<string> {
  const listed = await store.listProjects();
  if (!listed.ok) return name;
  const taken = new Set(listed.value.map((summary) => summary.name.toLowerCase()));
  return taken.has(name.toLowerCase()) ? `${name.slice(0, MAX_PROJECT_NAME_LENGTH - IMPORTED_SUFFIX.length)}${IMPORTED_SUFFIX}` : name;
}

/**
 * Reads a project zip a chunk at a time and stores it as a new project: its files first, then the record, then the thumbnail.
 * Anything wrong with the zip is `corrupt` (or `schema-too-new`) with the reason, and nothing is left behind (app R38). `onProgress(done, total)` counts entries.
 */
export async function importMaterialZip(store: MaterialImportTarget, source: ReadableStream<Uint8Array>, onProgress: ((done: number, total: number) => void) | undefined, options: ImportOptions): Promise<StoreResult<MaterialRecord>> {
  const processor = createMaterialZipEntryProcessor(store, options.newId ?? (() => crypto.randomUUID()), options.appId, onProgress, options.estimateFreeBytes);
  const read = await readZipEntries(source, processor.process);
  let failure: StoreError | undefined = read.failure;
  let parts: Awaited<ReturnType<typeof processor.finish>> | undefined;

  if (!failure) {
    const problem = !processor.hasManifest() ? 'The zip has no manifest.' : !processor.isComplete() || read.open || !hasEndRecord(read.tail) ? 'The zip is cut off or incomplete.' : findChecksumProblem(read.checksums, read.tail, read.sourceBytes);
    if (problem !== null) failure = describeFailure(problem);
  }
  if (!failure) {
    try {
      parts = await processor.finish();
    } catch (error) {
      failure = describeFailure(error);
    }
  }

  const cleanUp = async (): Promise<void> => {
    const projectId = processor.writtenProjectId();
    if (projectId !== undefined) await store.deleteProjects([projectId]); // the id is fresh, so only this import's files are under it
  };
  if (failure || !parts) {
    await cleanUp();
    return { ok: false, error: failure ?? storeFailure('corrupt', 'The zip could not be imported.').error };
  }
  const record: MaterialRecord = { ...parts.record, name: await nameFreeIn(store, parts.record.name) };
  const restored = await store.restoreProject(record);
  if (!restored.ok) {
    await cleanUp();
    return restored;
  }
  if (parts.thumbnail !== null) await store.saveThumbnail(restored.value.id, parts.thumbnail); // best effort: a project without a picture still opens
  return restored;
}
