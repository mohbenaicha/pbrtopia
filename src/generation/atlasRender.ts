// R37: how the snapshots of the atlas are drawn. 'grey' is the plain grey render of engine R10; 'wireframe' is the same with the triangle edges drawn over it;
// 'depth' makes each snapshot a depth map and 'depth-wireframe' adds the triangle edges to it; 'viewport' draws the model the way the viewport shows it.
export type AtlasRender = 'grey' | 'wireframe' | 'depth' | 'depth-wireframe' | 'viewport';

// mask-generation R2: the one look of a Metal-Roughness atlas; it is no AtlasRender (the Albedo channel's choice is not touched), only the label of the fixed, disabled select.
export const MASK_ATLAS_RENDER_LABEL = 'Color (unlit albedo)';

export const DEFAULT_ATLAS_RENDER: AtlasRender = 'grey';

export const ATLAS_RENDER_OPTIONS: readonly { value: AtlasRender; label: string }[] = [
  { value: 'grey', label: 'Default (grey)' },
  { value: 'wireframe', label: 'Wireframe' },
  { value: 'depth', label: 'Depth' },
  { value: 'depth-wireframe', label: 'Depth + wireframe' },
  { value: 'viewport', label: 'Current viewport' },
];
