import { buildOpenRouterPlugin } from '../openrouterModelPlugin';

// Krea K3 Edit (edit only: it needs at least one input image, which the atlas always is): 1K and 2K, up to 8 input images.
export const kreaK3EditPlugin = buildOpenRouterPlugin({
  id: 'krea/k3-edit',
  displayName: 'Krea K3 Edit',
  verifiedAt: '2026-11-18',
  resolutionValues: { '1K': '1K', '2K': '2K' },
  maxReferenceImages: 8,
  ratios: [[1, 1], [4, 3], [3, 2], [16, 9], [4, 5], [2, 3], [9, 16]],
});
