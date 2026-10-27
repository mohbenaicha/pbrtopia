import { describe, expect, it } from 'vitest';
import { createMapAdjustUniforms, setMapAdjust } from '../../src/viewport/mapAdjustUniforms';

describe('map adjust uniforms', () => {
  it('R14 they start at strength 1 and contrast 1 for metal, rough and normal', () => {
    const uniforms = createMapAdjustUniforms();
    expect(Object.keys(uniforms).sort()).toEqual(['metalContrast', 'metalStrength', 'normalContrast', 'normalStrength', 'roughContrast', 'roughStrength']);
    expect(Object.values(uniforms).map((uniform) => uniform.value)).toEqual([1, 1, 1, 1, 1, 1]);
  });

  it('R14 a patch of the Normal values changes them in place and leaves the others', () => {
    const uniforms = createMapAdjustUniforms();
    const held = uniforms.normalContrast;
    setMapAdjust(uniforms, { normalContrast: 2, normalStrength: 7 });
    expect(held.value).toBe(2);
    expect(uniforms.normalStrength.value).toBe(3);
    expect(uniforms.roughContrast.value).toBe(1);
  });

  it('R14 a patch changes only the named values, in place, so materials holding them see the change', () => {
    const uniforms = createMapAdjustUniforms();
    const held = uniforms.roughStrength;
    setMapAdjust(uniforms, { roughStrength: 2.5 });
    expect(held.value).toBe(2.5);
    expect(uniforms.roughStrength).toBe(held);
    expect(uniforms.metalStrength.value).toBe(1);
  });

  it('R14 values stay within 0 to 3', () => {
    const uniforms = createMapAdjustUniforms();
    setMapAdjust(uniforms, { metalStrength: 9, metalContrast: -4 });
    expect(uniforms.metalStrength.value).toBe(3);
    expect(uniforms.metalContrast.value).toBe(0);
  });
});
