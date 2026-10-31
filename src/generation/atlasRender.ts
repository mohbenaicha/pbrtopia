// R37: how the snapshots of the atlas are drawn. 'grey' is the plain grey render of engine R10; 'wireframe' is the same with the triangle edges drawn over it;
// 'viewport' draws the model the way the viewport shows it.
export type AtlasRender = 'grey' | 'wireframe' | 'viewport';

export const DEFAULT_ATLAS_RENDER: AtlasRender = 'grey';

export const ATLAS_RENDER_OPTIONS: readonly { value: AtlasRender; label: string }[] = [
  { value: 'grey', label: 'Default (grey)' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'viewport', label: 'Current viewport' },
];
