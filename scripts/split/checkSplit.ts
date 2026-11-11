// `npm run check:split`: prints every split-readiness problem and exits 1 when there is one (materialgen app R49, R50).
import path from 'node:path';
import { SOURCE_ALIASES } from '../../vite.config.ts';
import { runSplitCheck } from './runSplitCheck.ts';

const repoRoot = path.resolve(import.meta.dirname, '../..');
const manifestPath = path.join(repoRoot, 'package.json');

const problems = runSplitCheck({
  repoRoot,
  entry: path.join(repoRoot, 'src/materialgen/entry/main.tsx'),
  aliases: SOURCE_ALIASES,
  manifestPath,
  upstreamManifestPath: manifestPath, // after the split: path.join(repoRoot, 'upstream/package.json')
});
for (const problem of problems) console.error(problem);
if (problems.length > 0) process.exit(1);
console.log('check:split passed');
