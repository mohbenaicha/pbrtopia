import { describe, expect, it, vi } from 'vitest';
import { ImageTooLargeError, type PixelImage } from '@mat/imageops';
import type { MapsState } from '@mat/maps';
import { applyGeometryOp, type GeometryPorts } from '@mat/app/imageops/applyGeometryOp';

const grey = (value: number): PixelImage => ({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });
const record = (key: string) => ({ originalKey: key, workingKey: key, undoKey: null, width: 2, height: 2 });
const state = { size: 1024, maps: { albedo: record('a1'), normal: record('n1'), height: record('h1'), labels: record('l1') } } as unknown as MapsState;

function ports(patch: Partial<Parameters<typeof applyGeometryOp>[0]['ports']> = {}) {
  const base = {
    readPixels: vi.fn(async (key: string) => grey(key.charCodeAt(0))),
    transform: vi.fn<GeometryPorts['transform']>(async (image) => grey(image.data[0]! + 1)),
    applyEdits: vi.fn<GeometryPorts['applyEdits']>(async () => true),
  };
  return { ...base, ...patch } as typeof base;
}
const kindLabel = (kind: string): string => kind[0]!.toUpperCase() + kind.slice(1);
const run = (given: ReturnType<typeof ports>, label = 'Mirror') => applyGeometryOp({ state, label, kindLabel, ports: given });

describe('app imageops applyGeometryOp', () => {
  it('R11 every map but labels is changed, as one grouped commit with one edit per map', async () => {
    const given = ports();
    expect(await run(given)).toEqual({ ok: true });
    expect(given.applyEdits).toHaveBeenCalledTimes(1);
    const [edits, label, grouped] = given.applyEdits.mock.calls[0] as unknown as [Array<{ kind: string; image: PixelImage }>, string, boolean];
    expect(edits.map((edit) => edit.kind).sort()).toEqual(['albedo', 'height', 'normal']);
    expect(label).toBe('Mirror');
    expect(grouped).toBe(true);
    expect(edits.find((edit) => edit.kind === 'albedo')!.image.data[0]).toBe('a'.charCodeAt(0) + 1);
  });

  it('R31 R35 labels is never read or written', async () => {
    const given = ports();
    await run(given);
    expect(given.readPixels).not.toHaveBeenCalledWith('l1');
    expect(given.transform).toHaveBeenCalledTimes(3);
  });

  it('R4 each map is transformed as the kind it is', async () => {
    const given = ports();
    await run(given);
    const kinds = given.transform.mock.calls.map((call) => (call as unknown[])[1]).sort();
    expect(kinds).toEqual(['albedo', 'height', 'normal']);
  });

  it('R12 a map file that cannot be read changes nothing and names the map', async () => {
    const given = ports({ readPixels: vi.fn(async (key: string) => (key === 'n1' ? null : grey(1))) });
    expect(await run(given)).toEqual({ ok: false, message: 'Normal: the file cannot be read.' });
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('R12 a graphics error on any map changes nothing and says so', async () => {
    let calls = 0;
    const given = ports({ transform: vi.fn(async (image: PixelImage) => { calls += 1; if (calls === 2) throw new Error('lost'); return image; }) });
    expect(await run(given)).toEqual({ ok: false, message: 'Could not apply (graphics error). Nothing changed.' });
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('R24 an image above the graphics card limit is refused with its own message', async () => {
    const given = ports({ transform: vi.fn(async () => { throw new ImageTooLargeError(); }) });
    expect(await run(given)).toEqual({ ok: false, message: 'Image is too large for this graphics card.' });
  });

  it('R11 a commit that is refused is reported without a second message', async () => {
    const given = ports({ applyEdits: vi.fn(async () => false) });
    expect(await run(given)).toEqual({ ok: false });
  });

  it('R11 a project with no maps has nothing to change', async () => {
    const given = ports();
    expect(await applyGeometryOp({ state: { size: null, maps: {} } as unknown as MapsState, label: 'Crop', kindLabel, ports: given })).toEqual({ ok: true });
    expect(given.applyEdits).not.toHaveBeenCalled();
  });
});
