import type { ProjectListExporter } from '@shared/projects';
import { createZipListExporter, type ExportEnvironments } from '@shared/shell';
import { exportMaterialZip, type MaterialExportOutcome, type MaterialExportSource } from '@mat/storage';
import { APP_ID } from '../appIdentity';
import { describeMaterialExport } from '../project/materialZipTransfer';

const NOT_EXPORTED: MaterialExportOutcome = { droppedHeightBase: false };

/** Materialgen app R37, R39 and app/projects R16, R17: the project list's Export and Export selected over the material zip (`<name>.zip`). */
export const createMaterialListExporter = (source: MaterialExportSource, environments: ExportEnvironments = {}): ProjectListExporter =>
  createZipListExporter<MaterialExportOutcome>(
    {
      extension: 'zip',
      description: 'Material project',
      write: (project, sink) => exportMaterialZip(source, project.id, sink, undefined, { appId: APP_ID }),
      whenCancelled: NOT_EXPORTED,
      describe: describeMaterialExport,
    },
    environments,
  );
