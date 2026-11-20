import { buildOpenRouterPlugin } from '../openrouterModelPlugin';

// Qwen Image 2.1 Pro: 1K and 2K, up to 10 input images.
export const qwenImage21ProPlugin = buildOpenRouterPlugin({
  id: 'qwen/qwen-image-2.1-pro',
  displayName: 'Qwen Image 2.1 Pro',
  verifiedAt: '2026-11-18',
  resolutionValues: { '1K': '1K', '2K': '2K' },
  maxReferenceImages: 10,
  ratios: [[1, 1], [1, 2], [1, 4], [2, 1], [2, 3], [3, 2], [3, 4], [4, 1], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9], [21, 9], [9, 21]],
});
