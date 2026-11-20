import { expect } from 'vitest';
import type { ResolutionKey } from '../../../../../src/generation/catalog/modelTypes';
import type { OpenRouterModelPlugin } from '../../../../../src/generation/providers/openrouter/openrouterModelPlugin';

interface ExpectedPlugin {
  id: string;
  keys: ResolutionKey[];
  resolutionValues: Partial<Record<ResolutionKey, string>>;
  maxReferenceImages: number;
  ratios: string[]; // "w:h", any order
}

// R44, R47: what one plug-in file must say about its model (OpenRouter's documented values, docs/api/openrouter-image-models.md). Each model's own test
// calls this, so deleting a model's plug-in deletes its test with it.
export function expectPlugin(plugin: OpenRouterModelPlugin, expected: ExpectedPlugin): void {
  expect(plugin.row.id).toBe(expected.id);
  expect(plugin.row.provider).toBe('openrouter');
  expect(plugin.row.role).toBe('image');
  expect(plugin.row.resolutions.map((option) => option.key)).toEqual(expected.keys);
  expect(plugin.wire.resolutionValues).toEqual(expected.resolutionValues);
  expect(plugin.row.maxReferenceImages).toBe(expected.maxReferenceImages);
  expect(plugin.row.qualityLevels).toEqual([]);
  expect(plugin.wire.ratios.map(([w, h]) => `${w}:${h}`).sort()).toEqual([...expected.ratios].sort());
}
