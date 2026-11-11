// Materialgen app R49 and R50: what must hold before the material app moves to its own repository.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { comparePackages, type PackageManifest } from './comparePackages.ts';
import { collectBarePackages, type AliasMap } from './importGraph.ts';

export interface SplitCheckOptions {
  repoRoot: string;
  /** `entry/main.tsx` of the material app. */
  entry: string;
  aliases: AliasMap;
  /** The package.json this check runs in. */
  manifestPath: string;
  /** Before the split the same file; after it `upstream/package.json`. */
  upstreamManifestPath: string;
}

const readManifest = (file: string): PackageManifest => JSON.parse(readFileSync(file, 'utf8')) as PackageManifest;

/** R50: a nested install would load a second copy of react or three. */
export function findNestedInstall(repoRoot: string): string[] {
  return existsSync(path.join(repoRoot, 'upstream', 'node_modules'))
    ? ['nested install: upstream/node_modules exists; delete it and install once at the root']
    : [];
}

/** Every problem found, as plain lines; empty when the repository is ready to split. */
export function runSplitCheck(options: SplitCheckOptions): string[] {
  const used = collectBarePackages(options.entry, options.aliases);
  return [
    ...findNestedInstall(options.repoRoot),
    ...comparePackages(used, readManifest(options.manifestPath), readManifest(options.upstreamManifestPath)),
  ];
}
