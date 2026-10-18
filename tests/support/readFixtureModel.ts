import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

export type FixtureModelName = 'T-skarrik-21k' | 'kroot_elder_1model' | 'dow2-nob-heads-9k';

export function readFixtureModel(name: FixtureModelName): ArrayBuffer {
  const bytes = readFileSync(resolve(__dirname, '../fixtures/models', `${name}.glb`));
  return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}
