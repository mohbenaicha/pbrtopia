import { describe, expect, it } from 'vitest';
import { fingerprintImage } from '../../src/generation/fingerprintImage';

describe('fingerprintImage (R41)', () => {
  it('R41 is the SHA-256 of the bytes in lowercase hex', async () => {
    expect(await fingerprintImage(new Blob(['abc']))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('R41 equal bytes give equal fingerprints whatever the type, other bytes give another one', async () => {
    const a = await fingerprintImage(new Blob(['same'], { type: 'image/png' }));
    expect(await fingerprintImage(new Blob(['same'], { type: 'image/jpeg' }))).toBe(a);
    expect(await fingerprintImage(new Blob(['other']))).not.toBe(a);
  });
});
