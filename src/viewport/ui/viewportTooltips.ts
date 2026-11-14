// App tooltips R5, R6: the words of the viewport settings (the gear popover and Settings > Viewport), reviewed in one place.

export const VIEWPORT_TIPS = {
  // sections and subsections
  environment: 'The surroundings that light the model.',
  light: 'How bright the environment light is and where it comes from.',
  hdri: 'The 360-degree picture that lights and reflects on the model.',
  material: 'How the material maps are applied to the model in the viewport.',
  metal: 'Tunes how the metalness map is read.',
  roughness: 'Tunes how the roughness map is read.',
  normal: 'Tunes how the normal map is read.',
  view: 'How the model itself is drawn.',
  shading: 'Whether the surface looks faceted or smooth.',
  mesh: 'Options for showing the mesh structure.',
  // controls
  intensity: 'How bright the environment light is.',
  rotation: 'Turns the environment light around the model.',
  autoRotate: 'Turns the environment light slowly around the model.',
  background: 'Shows the environment picture behind the model.',
  backgroundBuiltIn: 'The built-in studio has no backdrop.',
  hdriChoice: 'The environment picture that lights the model.',
  strength: 'How strongly the map shows in the lighting.',
  contrast: "Pushes the map's light and dark values further apart.",
  angle: 'Edges sharper than this stay hard when the surface is smooth shaded.',
  wireframe: 'Draws the mesh edges over the model.',
} as const;
