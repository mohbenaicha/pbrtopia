import type { ExportTarget } from '../names/exportNames';
import { BLENDER_SCRIPT } from './blenderScript';
import { MAYA_SCRIPT } from './mayaScript';

export interface ExportScript {
  fileName: string;
  text: string;
}

/** Export R14, R17: the import script a target ships with, or none (Substance Painter and generic have no script). */
export function exportScriptFor(target: ExportTarget): ExportScript | null {
  if (target === 'blender') return { fileName: 'build_material.py', text: BLENDER_SCRIPT };
  if (target === 'maya') return { fileName: 'import_material.py', text: MAYA_SCRIPT };
  return null;
}
