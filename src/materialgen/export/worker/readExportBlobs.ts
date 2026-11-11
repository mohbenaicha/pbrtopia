import { kindLabel, type MapKind, type MapsState } from '@mat/maps';
import { ExportReadError } from '../build/buildExportZip';
import { storedKindOf, type ExportPlan } from '../plan/planExport';

/** The stored maps the plan reads: one per listed map file, the three packed sources for the packed file, the labels for the labels picture. */
export function storedKindsRead(plan: ExportPlan, state: MapsState): MapKind[] {
  const kinds = new Set<MapKind>();
  for (const file of plan.files) {
    if (file.kind === 'masks') continue;
    if (file.kind === 'labels') kinds.add('labels');
    else if (file.kind === 'orm') {
      if (plan.orm?.ao) kinds.add('ao');
      if (plan.orm?.rough) kinds.add('rough');
      if (plan.orm?.metal) kinds.add('metal');
    } else {
      const stored = storedKindOf(state, file.kind);
      if (stored !== undefined) kinds.add(stored);
    }
  }
  return [...kinds];
}

/**
 * Export R29, R30: the working copy of every map the plan reads, read once, as bytes. A file that is missing fails here with a message naming
 * the map, before any work starts. Writes nothing and changes no record.
 */
export async function readExportBlobs(
  plan: ExportPlan,
  state: MapsState,
  readBlob: (key: string) => Promise<Blob | null>,
  colorMode: 'albedo' | 'diffuse' = 'albedo',
): Promise<Partial<Record<MapKind, ArrayBuffer>>> {
  const files: Partial<Record<MapKind, ArrayBuffer>> = {};
  for (const kind of storedKindsRead(plan, state)) {
    const key = state.maps[kind]?.workingKey;
    const blob = key === undefined ? null : await readBlob(key);
    if (blob === null) throw new ExportReadError(kindLabel(kind, colorMode));
    files[kind] = await blob.arrayBuffer();
  }
  return files;
}
