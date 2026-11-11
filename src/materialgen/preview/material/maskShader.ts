// The GLSL of the mask overlay (preview R18), shared by the shaded material and the flat Albedo view.

// The labels are read by UV on every mesh (R57): one fetch, never blended (a blend of two labels is a third label).
export const MASK_UNIFORMS = `uniform sampler2D uMaskLabels;
uniform sampler2D uMaskPalette;
uniform float uMaskOpacity;
uniform float uMaskOn;
uniform float uMaskOnly;
`;

export const PALETTE_SIZE = 256; // one entry per label byte

/** Masks R80: the strength of a component highlight, whatever the overlay opacity is. */
export const HIGHLIGHT_STRENGTH = 0.75;

// The label of the texel picks its palette colour; a label with no palette entry keeps the colour. Written in the colour's own (linear) space: the palette texture is read as sRGB.
// With a highlight (uMaskOnly is a label, -1 when none) only that label is drawn, at the highlight strength, whether the overlay is on or not (masks R80).
const MASK_MIX = `
  if (uMaskOn > 0.5 || uMaskOnly >= 0.0) {
    float maskLabel = floor(texture2D(uMaskLabels, MASK_UV).r * 255.0 + 0.5);
    vec4 maskEntry = texture2D(uMaskPalette, vec2((maskLabel + 0.5) / ${PALETTE_SIZE}.0, 0.5));
    float maskAmount = uMaskOnly >= 0.0 ? (abs(maskLabel - uMaskOnly) < 0.5 ? ${HIGHLIGHT_STRENGTH.toFixed(2)} : 0.0) : uMaskOpacity;
    COLOR_TARGET = mix(COLOR_TARGET, maskEntry.rgb, maskAmount * maskEntry.a);
  }`;

/** The statement that mixes the palette colour into `target` using the labels at `uv`. */
export const maskMixFor = (uv: string, target: string): string => MASK_MIX.replace('MASK_UV', uv).replace(/COLOR_TARGET/g, target);
