import { buildOpenRouterPlugin } from '../openrouterModelPlugin';

// Microsoft MAI Image 2.7: no resolution field (aspect ratio only), so it offers 1K and sends none; up to 5 input images.
export const maiImage27Plugin = buildOpenRouterPlugin({
  id: 'microsoft/mai-image-2.7',
  displayName: 'MAI Image 2.7',
  verifiedAt: '2026-11-18',
  resolutionValues: {},
  maxReferenceImages: 5,
  ratios: [[1, 1], [4, 3], [3, 4], [16, 9], [9, 16], [3, 2], [2, 3]],
});
