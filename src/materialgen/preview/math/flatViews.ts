/** Preview R51: the view modes of the preview, in the order of the selector. */
export const PREVIEW_SHADINGS = ['lit', 'albedo', 'normal', 'rough', 'metal', 'height', 'ao'] as const;
export type PreviewShading = (typeof PREVIEW_SHADINGS)[number];

/** The modes that show one map unlit (everything but Shaded). */
export const FLAT_VIEWS = ['albedo', 'normal', 'rough', 'metal', 'height', 'ao'] as const;
export type FlatView = (typeof FLAT_VIEWS)[number];

export const isFlatView = (shading: PreviewShading): shading is FlatView => shading !== 'lit';
