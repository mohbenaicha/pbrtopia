import type { ExportProgress } from '../build/buildExportZip';
import { normalConventionFor } from '../plan/buildMaterialJson';
import type { ExportTarget } from '../names/exportNames';

export type ExportDialogTarget = Exclude<ExportTarget, 'generic'>;

export interface ExportTargetCard {
  target: ExportDialogTarget;
  title: string;
  /** How to bring the files in (export R20). */
  instructions: string;
  /** The normal convention this card writes (export R13). */
  convention: string;
}

const conventionText = (target: ExportTarget): string => (normalConventionFor(target) === 'opengl' ? 'OpenGL normals' : 'DirectX normals (green flipped)');

export const EXPORT_TARGET_CARDS: readonly ExportTargetCard[] = [
  { target: 'blender', title: 'Blender', instructions: 'In Blender open the Scripting tab, open build_material.py and run it. It builds a new material from the files next to it.', convention: conventionText('blender') },
  { target: 'maya', title: 'Maya', instructions: 'In Maya open the Script Editor, load import_material.py in a Python tab and run it. It builds an Arnold material from the files next to it.', convention: conventionText('maya') },
  { target: 'substance', title: 'Substance 3D Painter', instructions: 'Unzip, then drag all the files onto the layer stack, or import them with the usage set to texture.', convention: conventionText('substance') },
];

/** Export R33: "Encoding normal, 3 of 6". */
export const exportProgressText = (step: ExportProgress): string => `${step.text}, ${step.done} of ${step.total}`;

/** Export R34: "Exported <Name>.zip (<size> MB)". */
export const exportSuccessMessage = (fileName: string, byteLength: number): string => `Exported ${fileName} (${(byteLength / (1024 * 1024)).toFixed(1)} MB)`;

const TARGET_KEY = 'material-lab.export.target'; // export R20; the app id is final only when open item Q4 is settled
interface TargetStorage {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** Export R20: the target last exported in this browser, Blender when none (or when storage is blocked). */
export function loadLastExportTarget(storage: TargetStorage): ExportDialogTarget {
  try {
    const stored = storage.getItem(TARGET_KEY);
    return EXPORT_TARGET_CARDS.find((card) => card.target === stored)?.target ?? 'blender';
  } catch {
    return 'blender';
  }
}

export function saveLastExportTarget(storage: TargetStorage, target: ExportDialogTarget): void {
  try {
    storage.setItem(TARGET_KEY, target);
  } catch {
    // a blocked storage only loses the convenience
  }
}
