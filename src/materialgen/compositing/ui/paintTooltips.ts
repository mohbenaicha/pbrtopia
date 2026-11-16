/** What a tooltip says, as a heading and one or two plain sentences (compositing R49). */
export interface TooltipWords {
  heading: string;
  text: string;
}

/** The single source of the paint panel's tooltip words: change a wording here and nowhere else. */
export const PAINT_TOOLTIPS = {
  material: { heading: 'Material', text: 'The colour, roughness and metalness every stamp paints. Left empty, it paints plain grey with roughness 1 and metalness 0.' },
  shape: { heading: 'Shape', text: 'The silhouette of the stamp. Click a shape to switch it on or off; each stamp picks at random among the ones on (one stays on). Remove it with the x to change it. With no shape the stamp is a square.' },
  invert: { heading: 'Invert', text: 'Swaps black and white in this shape, so the stamp paints where it was clear.' },
  undo: { heading: 'Undo', text: 'Takes back the last stroke.' },
  redo: { heading: 'Redo', text: 'Brings back the stroke you took back.' },
  size: { heading: 'Size', text: 'How large each stamp is, as a fraction of the picture. Hold Alt and move the mouse sideways to resize.' },
  strength: { heading: 'Strength', text: 'How hard the stamp paints: its force. Below 1 the stamp is see-through and lets what is under it show.' },
  hardness: { heading: 'Hardness', text: 'The falloff towards the edge of the stamp. 1 is a crisp edge, 0 a soft blob.' },
  distance: { heading: 'Distance', text: 'The gap between two stamps along a stroke, in stamp widths. 1 puts them edge to edge.' },
  rotation: { heading: 'Rotation', text: 'The angle of the stamp. While painting, Alt and the mouse wheel turn it.' },
  dice: { heading: 'Random range', text: 'Switch on to give every stamp its own value between the two markers, instead of one fixed value.' },
  height: { heading: 'Height', text: 'Also paints into the height map, so the stamp raises or sinks the surface.' },
  heightLevel: { heading: 'Height level', text: 'How far each stamp raises (above 0) or sinks (below 0) the surface.' },
  additive: { heading: 'Additive', text: 'Each stamp adds to the height already there instead of replacing it.' },
  edgeBurn: { heading: 'Edge burn', text: 'Shades the rim of every stamp into the normal map, so the stamp reads as a bump or a dent.' },
  raiseDent: { heading: 'Raise | Dent', text: 'Whether the rim shades the stamp as a bump that stands out (Raise) or a dent that sinks in (Dent).' },
  burnWidth: { heading: 'Burn width', text: 'How wide the shaded rim is, in texels of the picture. A small width is a sharp bevel, a large one a broad slope.' },
  tool: { heading: 'Mode', text: 'Off paints a material through stamp shapes (Stamp). On, Clone copies a highlighted area of the maps and puts the copy down somewhere else.' },
  ghostShape: { heading: 'Square', text: 'The shape of the highlight brush: off is round, on is square. It shapes only the highlight, never the copy.' },
  cloneSize: { heading: 'Size', text: 'How large the highlight brush is, as a fraction of the picture. Hold Alt and move the mouse sideways to resize.' },
  scale: { heading: 'Scale', text: 'How large the copy is, in percent of the area you highlighted. You can also drag a corner of the copy.' },
  cloneHardness: { heading: 'Hardness', text: 'How the edge of the copy fades into what is under it. 1 keeps the edge as you painted it, 0 fades it softly over a quarter of the brush size.' },
  cloneStrength: { heading: 'Strength', text: 'How much of the copy shows. 1 replaces what is under it, 0 changes nothing.' },
  clone: { heading: 'Clone', text: 'Lifts the highlighted area into a copy you can drag, turn and scale. Enter does the same.' },
  confirm: { heading: 'Confirm', text: 'Puts the copy down and keeps the highlight, so you can copy it again. Enter does the same. Undo takes it back.' },
  done: { heading: 'Done', text: 'Keeps the painted maps and leaves the paint tool.' },
  cancel: { heading: 'Cancel', text: 'Throws the painting away and leaves the paint tool.' },
} as const satisfies Record<string, TooltipWords>;

export type PaintTooltipKey = keyof typeof PAINT_TOOLTIPS;
