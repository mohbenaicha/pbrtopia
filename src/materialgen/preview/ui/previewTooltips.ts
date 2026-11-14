// App tooltips R5, R6: the words of the preview's material controls (the gear popover and Settings > Viewport), reviewed in one place.

export const PREVIEW_TIPS = {
  // subsections
  height: 'How the height map displaces the surface in the preview.',
  occlusion: 'How the ambient occlusion map darkens crevices in the preview.',
  tiling: 'How often the material repeats across the preview surface.',
  mesh: 'How finely the preview surface is divided.',
  // controls
  heightScale: 'How far the height map pushes the surface out.',
  heightLevel: 'The height that counts as flat; lower parts sink, higher parts rise.',
  heightContrast: 'Stretches the height map so the relief is deeper.',
  occlusionIntensity: 'How dark the occlusion map makes the crevices.',
  tilingX: 'How many times the material repeats across the surface.',
  tilingY: 'How many times the material repeats up the surface.',
  meshResolution: 'How finely the preview mesh is cut; higher shows more relief.',
} as const;
