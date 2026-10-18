import { describe, expect, it } from 'vitest';
import { inspectGlb } from '../../src/viewport/inspectGlb';
import { buildGlbFromJsonText, buildTriangleGlb } from './glbBuilder';

describe('inspectGlb', () => {
  it('Additional-tests a plain GLB is accepted', () => {
    expect(inspectGlb(buildTriangleGlb())).toEqual({ ok: true });
  });

  it('Additional-tests a file that is not a GLB gives not-glb', () => {
    const text = new TextEncoder().encode('{"asset":{"version":"2.0"}}').buffer;
    expect(inspectGlb(text)).toMatchObject({ ok: false, code: 'not-glb' });
    expect(inspectGlb(new ArrayBuffer(4))).toMatchObject({ ok: false, code: 'not-glb' });
    expect(inspectGlb(new ArrayBuffer(0))).toMatchObject({ ok: false, code: 'not-glb' });
  });

  it.each(['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'])('Additional-tests %s gives unsupported-compression and names it', (extension) => {
    for (const field of ['extensionsUsed', 'extensionsRequired'] as const) {
      const result = inspectGlb(buildTriangleGlb({ [field]: [extension] }));
      expect(result).toMatchObject({ ok: false, code: 'unsupported-compression' });
      expect((result as { message: string }).message).toContain(extension);
    }
  });

  it('Additional-tests other extensions do not count as compression', () => {
    expect(inspectGlb(buildTriangleGlb({ extensionsUsed: ['KHR_materials_emissive_strength'] }))).toEqual({ ok: true });
  });

  it('Additional-tests a GLB whose header JSON is unreadable gives parse-failed', () => {
    expect(inspectGlb(buildGlbFromJsonText('{not json'))).toMatchObject({ ok: false, code: 'parse-failed' });
  });
});
