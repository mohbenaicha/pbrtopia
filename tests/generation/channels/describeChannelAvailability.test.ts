import { describe, expect, it } from 'vitest';
import { channelPanelFields, describeChannelAvailability, type ChannelAvailabilityInput } from '../../../src/generation/channels/describeChannelAvailability';

const NO_ALBEDO = 'Bake or apply one albedo to the whole model first.';
const NOT_SQUARE = 'Normal maps need a square albedo picture.';
const BUSY = 'Wait for the current task to finish.';

const ready: ChannelAvailabilityInput = { hasModel: true, busy: false, setOpen: false, albedoPictureIds: ['p1', 'p1'], sourceIsSquare: true };
const describeWith = (patch: Partial<ChannelAvailabilityInput>) => describeChannelAvailability({ ...ready, ...patch });

describe('channel availability', () => {
  it('normal-map R2 one generated picture on every material enables both generated channels', () => {
    const map = describeWith({});
    expect(map.albedo.enabled).toBe(true);
    expect(map.normal).toEqual({ enabled: true });
    expect(map['metal-rough']).toEqual({ enabled: true });
  });

  it('normal-map R2 an original texture (null id) on any material disables normal and metal-rough with the exact reason', () => {
    const map = describeWith({ albedoPictureIds: ['p1', null], sourceIsSquare: null });
    expect(map.normal).toEqual({ enabled: false, reason: NO_ALBEDO });
    expect(map['metal-rough']).toEqual({ enabled: false, reason: NO_ALBEDO });
    expect(map.albedo.enabled).toBe(true);
  });

  it('normal-map R2 two different pictures, none, or no model disable them', () => {
    expect(describeWith({ albedoPictureIds: ['a', 'b'], sourceIsSquare: null }).normal.reason).toBe(NO_ALBEDO);
    expect(describeWith({ albedoPictureIds: [], sourceIsSquare: null }).normal.reason).toBe(NO_ALBEDO);
    expect(describeWith({ hasModel: false, albedoPictureIds: [], sourceIsSquare: null }).normal.reason).toBe(NO_ALBEDO);
  });

  it('normal-map R2 a non-square source disables Normal with its own reason but leaves Metal-Roughness alone', () => {
    const map = describeWith({ sourceIsSquare: false });
    expect(map.normal).toEqual({ enabled: false, reason: NOT_SQUARE });
    expect(map['metal-rough'].enabled).toBe(true);
  });

  it('normal-map R2 busy or an open set disables the generated channels with the busy reason; albedo stays enabled', () => {
    for (const patch of [{ busy: true }, { setOpen: true }]) {
      const map = describeWith(patch);
      expect(map.normal).toEqual({ enabled: false, reason: BUSY });
      expect(map['metal-rough']).toEqual({ enabled: false, reason: BUSY });
      expect(map.albedo.enabled).toBe(true);
    }
  });

  it('normal-map R4 the normal panel shows only detail; albedo shows prompt, references, atlas and the custom gear', () => {
    expect(channelPanelFields('normal')).toEqual({ prompt: false, references: false, atlas: false, customGear: false, detail: true, masks: false });
    expect(channelPanelFields('albedo')).toEqual({ prompt: true, references: true, atlas: true, customGear: true, detail: false, masks: false });
  });

  it('mask-generation R2 the Metal-Roughness panel shows the prompt (as the describe field) and the atlas size, and the Custom setup gear, and hides references and the detail slider', () => {
    expect(channelPanelFields('metal-rough')).toEqual({ prompt: true, references: false, atlas: true, customGear: true, detail: false, masks: true });
  });
});
