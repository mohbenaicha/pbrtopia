import { zipFileName } from '@shared/shell';
import type { MapKind } from './mapKinds';

const MAP_WORDS: Record<Exclude<MapKind, 'albedo' | 'diffuse'>, string> = {
  normal: 'normal-opengl',
  height: 'height',
  rough: 'roughness',
  metal: 'metallic',
  ao: 'ao',
  labels: 'labels',
};

/** Export R35 (maps R48): `<Name>-<map>.png`; the colour map is albedo or diffuse by the colour mode. */
export function mapDownloadName(projectName: string, kind: MapKind, colorMode: 'albedo' | 'diffuse'): string {
  const word = kind === 'albedo' || kind === 'diffuse' ? colorMode : MAP_WORDS[kind];
  return zipFileName(`${projectName}-${word}`, 'png');
}
