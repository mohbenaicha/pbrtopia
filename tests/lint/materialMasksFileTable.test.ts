import { existsSync, readdirSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { SOURCE_ALIASES } from '../../vite.config';
import { listImportSpecifiers, resolveImport } from '../../scripts/split/importGraph';

const repoRoot = path.resolve(__dirname, '../..');
const src = path.join(repoRoot, 'src');
const ROOTS = ['materialMasks', 'workerJob'].map((name) => path.join(src, name));
/** What src/materialMasks and src/workerJob may import by `@shared/<folder>` (material-masks-core R9). */
const ALLOWED_SHARED = ['ui-kit', 'generation', 'materialMasks', 'workerJob'];

interface TableRow { source: string; decision: string; target: string }

function readFileTable(): TableRow[] {
  const text = readFileSync(path.join(repoRoot, 'docs/materialMasks-file-table.md'), 'utf8');
  return text.split(/\r?\n/).filter((line) => line.startsWith('| src/')).map((line) => {
    const [source, decision, target] = line.split('|').slice(1, 4).map((cell) => cell.trim());
    return { source: source!, decision: decision!, target: target!.split(' ')[0]! }; // a note may follow the destination path
  });
}

function listSources(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) return listSources(full);
    return /\.tsx?$/.test(entry.name) ? [full] : [];
  });
}

describe('material-masks-core R2 the file table', () => {
  const rows = readFileTable();

  it('material-masks-core R2 the table lists the files it decides on', () => {
    expect(rows.length).toBeGreaterThan(50);
    expect(new Set(rows.map((row) => row.decision))).toEqual(new Set(['moved', 'stays']));
  });

  it('material-masks-core R2 every moved file is gone from its source and present at its destination', () => {
    const wrong = rows.filter((row) => row.decision === 'moved').filter((row) => existsSync(path.join(repoRoot, row.source)) || !existsSync(path.join(repoRoot, row.target)));
    expect(wrong.map((row) => row.source)).toEqual([]);
  });

  it('material-masks-core R2 every staying file is still in materialgen and not under materialMasks', () => {
    const wrong = rows.filter((row) => row.decision === 'stays').filter((row) => !existsSync(path.join(repoRoot, row.source)) || !row.source.startsWith('src/materialgen/'));
    expect(wrong.map((row) => row.source)).toEqual([]);
  });
});

describe('material-masks-core R9 no outbound imports', () => {
  it('material-masks-core R9 materialMasks and workerJob import only their own files, ui-kit, generation and packages', () => {
    const offenders: string[] = [];
    for (const root of ROOTS) {
      for (const file of listSources(root)) {
        for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
          const label = `${path.relative(repoRoot, file).split(path.sep).join('/')} -> ${specifier}`;
          if (specifier.startsWith('@mat/')) offenders.push(label);
          else if (specifier.startsWith('@shared/')) {
            if (!ALLOWED_SHARED.includes(specifier.slice('@shared/'.length).split('/')[0]!)) offenders.push(label);
          } else if (specifier.startsWith('.')) {
            const resolved = resolveImport(specifier, file, SOURCE_ALIASES);
            if (resolved.kind === 'missing') offenders.push(label);
            else if (resolved.kind === 'file' && !ROOTS.some((own) => resolved.file.startsWith(own + path.sep))) offenders.push(label);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });

  it('material-masks-core R9 no file outside materialgen imports a materialgen file', () => {
    const offenders: string[] = [];
    const matRoot = path.join(src, 'materialgen');
    for (const file of listSources(src)) {
      if (file.startsWith(matRoot + path.sep)) continue;
      for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
        const resolved = resolveImport(specifier, file, SOURCE_ALIASES);
        if (resolved.kind === 'file' && resolved.file.startsWith(matRoot + path.sep)) offenders.push(`${path.relative(repoRoot, file)} -> ${specifier}`);
      }
    }
    expect(offenders).toEqual([]);
  });
});
