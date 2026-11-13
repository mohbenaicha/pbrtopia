import { describe, expect, it } from 'vitest';
import { SEAM_FRAGMENT } from '@mat/imageops/geometry/geometryShaders';
import { SEAM_GLSL } from '@mat/imageops/geometry/seamGlsl';

describe('materialgen/imageops Blend edges shaders', () => {
  it('R68 the Apply pass carries the very GLSL the viewport carries, so preview and Apply share one function', () => {
    expect(SEAM_FRAGMENT).toContain(SEAM_GLSL);
    expect(SEAM_GLSL).toContain('vec4 seamBlend(');
  });

  it('R64 the mirror partner of a row is the row across the middle, and the weight is 1 at the border and 0 at the depth', () => {
    expect(SEAM_GLSL).toContain('1.0 - p.x');
    expect(SEAM_GLSL).toContain('clamp(1.0 - distance / depth, 0.0, 1.0)');
  });

  it('R64 no component of a normal map is flipped and nothing is renormalised in the blend', () => {
    expect(SEAM_GLSL).not.toMatch(/1\.0 - c\.[rg]|renormalise/);
    expect(SEAM_FRAGMENT).not.toMatch(/uNormal\b/); // the pass has no normal-map switch at all
  });

  it('R4 R68 albedo is decoded by the upload and encoded in the last step, like the other geometry passes', () => {
    expect(SEAM_FRAGMENT).toContain('uEncodeSrgb');
    expect(SEAM_FRAGMENT).toContain('encodeSrgb(');
  });

  it('R66 the profile is read with two nearest fetches and a lerp, never with filtering a float texture', () => {
    expect(SEAM_GLSL).toContain('texelFetch(');
    expect(SEAM_GLSL).not.toContain('texture2D(profile');
  });
});
