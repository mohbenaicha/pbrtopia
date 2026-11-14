// App tooltips R5, R6: the words of the Material Masks controls, reviewed in one place.

export const MASK_TIPS = {
  feather: 'Softens the borders between components so the materials blend.',
  height: 'Raises or sinks this component in the height map; 0 leaves it level.',
  material: 'The real-world material this component is made of; it sets the starting roughness and metalness.',
  roughness: 'How rough this component is: 0 is mirror smooth, 1 is fully matte.',
  metalness: 'How metallic this component is: 0 is a non-metal, 1 is bare metal.',
  mixinInvert: 'Lets dark albedo drive the mixin instead of bright albedo.',
  mixinRoughness: 'How much the albedo shifts roughness inside this component.',
  mixinMetalness: 'How much the albedo shifts metalness inside this component.',
} as const;
