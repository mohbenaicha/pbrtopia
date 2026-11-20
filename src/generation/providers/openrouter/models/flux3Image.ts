import { buildOpenRouterPlugin } from '../openrouterModelPlugin';

// Black Forest Labs FLUX.3 Image: 1K, 2K and 4K (768 and 1.5K are not keys of the app), up to 10 input images.
export const flux3ImagePlugin = buildOpenRouterPlugin({
  id: 'black-forest-labs/flux-3-image',
  displayName: 'FLUX.3 Image',
  verifiedAt: '2026-11-18',
  resolutionValues: { '1K': '1K', '2K': '2K', '4K': '4K' },
  maxReferenceImages: 10,
  ratios: [[21, 9], [2, 1], [16, 9], [3, 2], [7, 5], [4, 3], [5, 4], [1, 1], [4, 5], [3, 4], [5, 7], [2, 3], [9, 16], [1, 2], [9, 21]],
});
