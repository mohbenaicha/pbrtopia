// Static import-graph walker used by the isolation tests (specs/shared/materialgen-prep R4-R5).
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import ts from 'typescript';

export type AliasMap = Readonly<Record<string, string>>;
export interface ForbiddenHit {
  file: string;
  /** Files from the entry to the forbidden file, inclusive. */
  chain: string[];
}
export interface UnresolvedImport {
  from: string;
  specifier: string;
}
export interface ReachReport {
  reached: ForbiddenHit[];
  unresolved: UnresolvedImport[];
}

const SOURCE_EXTENSIONS = ['.ts', '.tsx'];

/** Every module specifier in a source text: static, type-only, re-export and string-literal dynamic imports. */
export function listImportSpecifiers(sourceText: string, fileName: string): string[] {
  const file = ts.createSourceFile(fileName, sourceText, ts.ScriptTarget.ES2022, false);
  const found: string[] = [];
  const visit = (node: ts.Node): void => {
    if ((ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) && node.moduleSpecifier && ts.isStringLiteral(node.moduleSpecifier)) {
      found.push(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments[0] &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      found.push(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(file);
  return found;
}

function isFile(candidate: string): boolean {
  return existsSync(candidate) && statSync(candidate).isFile();
}

function resolveOnDisk(base: string): string | null {
  if (isFile(base)) return base;
  for (const extension of SOURCE_EXTENSIONS) if (isFile(base + extension)) return base + extension;
  for (const extension of SOURCE_EXTENSIONS) {
    const index = path.join(base, `index${extension}`);
    if (isFile(index)) return index;
  }
  return null;
}

/** Maps a specifier to an absolute path base, or null for a bare package (react, three...). */
function toPathBase(specifier: string, fromFile: string, aliases: AliasMap): string | null {
  const clean = specifier.replace(/\?.*$/, '');
  if (clean.startsWith('.')) return path.resolve(path.dirname(fromFile), clean);
  for (const [prefix, target] of Object.entries(aliases)) {
    if (clean === prefix) return target;
    if (clean.startsWith(`${prefix}/`)) return path.join(target, clean.slice(prefix.length + 1));
  }
  return null;
}

export type ResolvedImport =
  | { kind: 'package' }
  | { kind: 'missing' }
  | { kind: 'file'; file: string };

/** Resolves one specifier the way the bundler would: relative, alias or bare package. */
export function resolveImport(specifier: string, fromFile: string, aliases: AliasMap): ResolvedImport {
  const base = toPathBase(specifier, fromFile, aliases);
  if (base === null) return { kind: 'package' };
  const file = resolveOnDisk(path.normalize(base));
  return file === null ? { kind: 'missing' } : { kind: 'file', file };
}

function isForbidden(file: string, forbiddenDirectories: readonly string[]): boolean {
  return forbiddenDirectories.some((directory) => file === directory || file.startsWith(directory + path.sep));
}

/**
 * Walks every import reachable from `entry` (barrels included) and reports the files inside the forbidden
 * directories, each with the chain that led to it. `forbidden` entries use the same aliases as the code.
 * Imports that name no file are reported rather than skipped; css/glsl/other assets are leaves.
 */
export function findForbiddenReach(entry: string, forbidden: readonly string[], aliases: AliasMap): ReachReport {
  const forbiddenDirectories = forbidden.map((item) => {
    const base = toPathBase(item, entry, aliases);
    if (!base) throw new Error(`Forbidden entry ${item} does not use a known alias`);
    return path.normalize(base);
  });
  const reached: ForbiddenHit[] = [];
  const unresolved: UnresolvedImport[] = [];
  const seen = new Set<string>();
  const walk = (file: string, chain: string[]): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (isForbidden(file, forbiddenDirectories)) reached.push({ file, chain });
    if (!SOURCE_EXTENSIONS.includes(path.extname(file))) return;
    for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
      const base = toPathBase(specifier, file, aliases);
      if (base === null) continue;
      const resolved = resolveOnDisk(path.normalize(base));
      if (resolved === null) unresolved.push({ from: file, specifier });
      else walk(resolved, [...chain, resolved]);
    }
  };
  walk(path.normalize(entry), [path.normalize(entry)]);
  return { reached, unresolved };
}

/** "three/examples/jsm/x.js" -> "three"; "@scope/pkg/sub" -> "@scope/pkg". */
function toPackageName(specifier: string): string {
  const parts = specifier.split('/');
  return specifier.startsWith('@') ? parts.slice(0, 2).join('/') : (parts[0] ?? specifier);
}

/**
 * Every bare package (react, three, @scope/pkg...) imported by the files reachable from `entry`, once each,
 * sorted. Node built-ins (`node:`) are not packages. Used by the split check (materialgen app R49).
 */
export function collectBarePackages(entry: string, aliases: AliasMap): string[] {
  const packages = new Set<string>();
  const seen = new Set<string>();
  const walk = (file: string): void => {
    if (seen.has(file)) return;
    seen.add(file);
    if (!SOURCE_EXTENSIONS.includes(path.extname(file))) return;
    for (const specifier of listImportSpecifiers(readFileSync(file, 'utf8'), file)) {
      const base = toPathBase(specifier, file, aliases);
      if (base === null) {
        if (!specifier.startsWith('node:')) packages.add(toPackageName(specifier));
        continue;
      }
      const resolved = resolveOnDisk(path.normalize(base));
      if (resolved !== null) walk(resolved);
    }
  };
  walk(path.normalize(entry));
  return [...packages].sort();
}
