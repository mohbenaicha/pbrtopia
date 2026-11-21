// Isolation rules for the material generator (specs/shared/materialgen-prep R7). This repository only:
// it keeps "nobody outside src/materialgen imports it" and "materialgen reaches shared code through barrels".
import { readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { listImportSpecifiers, resolveImport, type AliasMap } from '../../scripts/split/importGraph';

export interface IsolationViolation {
  /** Path from the folder holding `src`, with forward slashes. */
  file: string;
  specifier: string;
  rule: 'outside-imports-materialgen' | 'leaves-materialgen' | 'shared-folder-not-allowed' | 'shared-folder-not-barrel';
}

function listSourceFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSourceFiles(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

const isInside = (file: string, directory: string): boolean => file.startsWith(directory + path.sep);

export function findIsolationViolations(
  srcRoot: string,
  allowedSharedFolders: readonly string[],
  aliases: AliasMap,
  /** Declared sub-barrels (`folder/sub`) that may be imported besides the folder's own index, e.g. the drawing half of a worker-safe folder (material-masks-core R9). */
  allowedSubBarrels: readonly string[] = [],
): IsolationViolation[] {
  const matRoot = path.join(srcRoot, 'materialgen');
  const violations: IsolationViolation[] = [];
  for (const file of listSourceFiles(srcRoot)) {
    const insideMat = isInside(file, matRoot);
    const label = path.relative(path.dirname(srcRoot), file).split(path.sep).join('/');
    for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
      const add = (rule: IsolationViolation['rule']): void => {
        violations.push({ file: label, specifier, rule });
      };
      const resolved = resolveImport(specifier, file, aliases);
      if (!insideMat) {
        if (resolved.kind === 'file' && isInside(resolved.file, matRoot)) add('outside-imports-materialgen');
        continue;
      }
      if (specifier.startsWith('.')) {
        if (resolved.kind === 'file' && !isInside(resolved.file, matRoot)) add('leaves-materialgen');
        else if (resolved.kind === 'missing') add('leaves-materialgen');
        continue;
      }
      if (specifier.startsWith('@shared/')) {
        const [folder, ...rest] = specifier.slice('@shared/'.length).split('/');
        if (!folder || !allowedSharedFolders.includes(folder)) add('shared-folder-not-allowed');
        else if (rest.length > 0 && !(rest.length === 1 && rest[0] === 'index') && !allowedSubBarrels.includes(`${folder}/${rest.join('/')}`)) add('shared-folder-not-barrel');
      }
    }
  }
  return violations;
}
