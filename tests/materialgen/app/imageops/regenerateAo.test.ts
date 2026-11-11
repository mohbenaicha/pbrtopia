import { describe, expect, it, vi } from 'vitest';
import { createDefaultAoValues, type PixelImage } from '@mat/imageops';
import { regenerateAo } from '@mat/app/imageops/regenerateAo';

const grey = (value: number): PixelImage => ({ width: 2, height: 2, channels: 1, data: new Uint8Array(4).fill(value) });

function ports(patch: Partial<Parameters<typeof regenerateAo>[0]['ports']> = {}) {
  const session = { size: 2, previewSize: 2, renderPreview: vi.fn(), renderFinal: vi.fn(async () => grey(77)), close: vi.fn() };
  const given = {
    readPixels: vi.fn(async () => grey(10)),
    openAo: vi.fn(async () => session),
    applyEdits: vi.fn(async () => true),
    ...patch,
  };
  return { given, session };
}

const run = (given: ReturnType<typeof ports>['given'], values = createDefaultAoValues('height')) =>
  regenerateAo({ source: 'height', sourceKey: 'h2', sourceLabel: 'Height', values, ports: given });

describe('app imageops regenerateAo', () => {
  it('R44 renders AO at S with the given parameters and commits one single-map edit derived from the source working key', async () => {
    const { given, session } = ports();
    const values = { ...createDefaultAoValues('height'), depth: 5 };
    expect(await run(given, values)).toEqual({ ok: true });
    expect(given.readPixels).toHaveBeenCalledWith('h2');
    expect(given.openAo).toHaveBeenCalledWith(expect.objectContaining({ width: 2 }), 'height');
    expect(session.renderFinal).toHaveBeenCalledWith(values);
    expect(given.applyEdits).toHaveBeenCalledWith([{ kind: 'ao', image: grey(77), derivedFrom: { kind: 'height', key: 'h2' } }], 'Regenerate AO', false);
  });

  it('R44 the session is closed after a success', async () => {
    const { given, session } = ports();
    await run(given);
    expect(session.close).toHaveBeenCalledTimes(1);
  });

  it('R44 a source file that cannot be read changes nothing and names the map', async () => {
    const { given } = ports({ readPixels: vi.fn(async () => null) });
    expect(await run(given)).toEqual({ ok: false, message: 'Height: the file cannot be read.' });
    expect(given.openAo).not.toHaveBeenCalled();
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('R12 a graphics error changes nothing, says so, and still closes the session', async () => {
    const { given, session } = ports();
    session.renderFinal.mockRejectedValueOnce(new Error('lost'));
    expect(await run(given)).toEqual({ ok: false, message: 'Could not regenerate (graphics error). Nothing changed.' });
    expect(session.close).toHaveBeenCalledTimes(1);
    expect(given.applyEdits).not.toHaveBeenCalled();
  });

  it('R12 a session that cannot be opened says the same', async () => {
    const { given } = ports({ openAo: vi.fn(async () => { throw new Error('no graphics'); }) });
    expect(await run(given)).toEqual({ ok: false, message: 'Could not regenerate (graphics error). Nothing changed.' });
  });

  it('R44 a commit that is refused is reported without a second message (the controller already gave one)', async () => {
    const { given } = ports({ applyEdits: vi.fn(async () => false) });
    expect(await run(given)).toEqual({ ok: false });
  });
});
