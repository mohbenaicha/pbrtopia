import { describe, expect, it, vi } from 'vitest';
import { createDefaultNormalValues, type PixelImage } from '@mat/imageops';
import { regenerateNormal } from '@mat/app/imageops/regenerateNormal';

const grey = (value: number): PixelImage => ({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });
const normal: PixelImage = { width: 2, height: 2, channels: 3, data: new Uint8Array(12).fill(128) };

function ports(patch: Partial<Parameters<typeof regenerateNormal>[0]['ports']> = {}) {
  const session = { size: 2, previewSize: 2, renderPreview: vi.fn(), renderFinal: vi.fn(async () => normal), close: vi.fn() };
  const given = {
    readPixels: vi.fn(async () => grey(10)),
    openNormal: vi.fn(async () => session),
    applyEdits: vi.fn(async () => true),
    ...patch,
  };
  return { given, session };
}

const run = (given: ReturnType<typeof ports>['given'], values = createDefaultNormalValues()) =>
  regenerateNormal({ heightKey: 'h2', heightLabel: 'Height', values, ports: given });

describe('app imageops regenerateNormal', () => {
  it('normal-from-height R8 computes the normal map at S from the remembered parameters and commits one single-map edit derived from the height key', async () => {
    const { given, session } = ports();
    const values = { blur: 2, strength: 60 };
    expect(await run(given, values)).toEqual({ ok: true });
    expect(given.readPixels).toHaveBeenCalledWith('h2');
    expect(given.openNormal).toHaveBeenCalledWith(expect.objectContaining({ width: 2 }));
    expect(session.renderFinal).toHaveBeenCalledWith(values);
    expect(given.applyEdits).toHaveBeenCalledWith([{ kind: 'normal', image: normal, derivedFrom: { kind: 'height', key: 'h2' } }], 'Regenerate normal map', false);
  });

  it('normal-from-height R10 the session is closed after a success', async () => {
    const { given, session } = ports();
    await run(given);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('normal-from-height R8 a height file that cannot be read changes nothing and names the map', async () => {
    const { given } = ports({ readPixels: vi.fn(async () => null) });
    expect(await run(given)).toEqual({ ok: false, message: 'Height: the file cannot be read.' });
    expect(given.openNormal).not.toHaveBeenCalled();
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('normal-from-height R8 R10 a computation that fails changes nothing, says so, and still closes the session', async () => {
    const { given, session } = ports();
    session.renderFinal.mockRejectedValueOnce(new Error('worker lost'));
    expect(await run(given)).toEqual({ ok: false, message: 'Could not regenerate the normal map. Nothing changed.' });
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('normal-from-height R8 R10 a session that cannot be opened says the same', async () => {
    const { given } = ports({ openNormal: vi.fn(async () => { throw new Error('no worker'); }) });
    expect(await run(given)).toEqual({ ok: false, message: 'Could not regenerate the normal map. Nothing changed.' });
  });

  it('normal-from-height R8 a commit that is refused is reported without a second message (the controller already gave one)', async () => {
    const { given } = ports({ applyEdits: vi.fn(async () => false) });
    expect(await run(given)).toEqual({ ok: false });
  });
});
