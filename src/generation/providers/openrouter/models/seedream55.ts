import { buildOpenRouterPlugin } from '../openrouterModelPlugin';

// ByteDance Seedream 5.5: 1K and 2K (1.5K is not a key of the app), up to 10 input images.
export const seedream55Plugin = buildOpenRouterPlugin({
  id: 'bytedance-seed/seedream-5-5',
  displayName: 'Seedream 5.5',
  verifiedAt: '2026-11-18',
  resolutionValues: { '1K': '1K', '2K': '2K' },
  maxReferenceImages: 10,
  ratios: [[1, 1], [1, 2], [2, 1], [2, 3], [3, 2], [3, 4], [4, 3], [4, 5], [5, 4], [9, 16], [16, 9], [9, 19.5], [19.5, 9], [9, 20], [20, 9], [9, 21], [21, 9]],
});
