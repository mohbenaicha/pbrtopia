import { describe, expect, it } from 'vitest';
import { readSheetHeight } from '../../../../src/generation/normal/height/readSheetHeight';

describe('readSheetHeight', () => {
  it('normal-height-edit R1 a colour answer is read as its Rec. 709 luminance, a grey one as its level', () => {
    const rgba = new Uint8ClampedArray([255, 0, 0, 255, 0, 255, 0, 255, 0, 0, 255, 255, 102, 102, 102, 255]);
    const luma = readSheetHeight({ side: 2, rgba });
    expect(luma[0]).toBeCloseTo(0.2126, 4);
    expect(luma[1]).toBeCloseTo(0.7152, 4);
    expect(luma[2]).toBeCloseTo(0.0722, 4);
    expect(luma[3]).toBeCloseTo(0.4, 4);
  });
});
