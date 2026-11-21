import { describe, expect, it, vi } from 'vitest';
import type { PixelImage } from '@shared/materialMasks';
import { DEFAULT_FEATHER, createMasksSteps, hexToRgb, paletteFor, parseBaseMaterials, type MasksBuild, type MasksStepDeps } from '@shared/materialMasks';

const table = parseBaseMaterials({ Brick: [0.8, 0, [160, 60, 40]], Steel: [0.3, 1, [200, 200, 205]], Moss: [0.9, 0, [60, 120, 40]] });
const reply = JSON.stringify([
  { name: 'Red brick', description: 'brick wall', location: 'left' },
  { name: 'Steel plate', description: 'steel metal', location: 'right' },
  { name: 'Moss', description: 'green moss', location: 'bottom' },
]);
const answer = { components: [
  { name: 'Red brick', description: 'brick wall', location: 'left' },
  { name: 'Steel plate', description: 'steel metal', location: 'right' },
] };
const palette = paletteFor(2);

/** A decomposition picture: left half palette colour 0, right half colour 1. */
function decomposition(side = 16): PixelImage {
  const data = new Uint8Array(side * side * 3);
  for (let y = 0; y < side; y += 1) for (let x = 0; x < side; x += 1) data.set(hexToRgb(palette[x < side / 2 ? 0 : 1]!.hex), (y * side + x) * 3);
  return { width: side, height: side, channels: 3, data };
}

function deps(overrides: Partial<MasksStepDeps> = {}): MasksStepDeps & { commits: Array<{ build: MasksBuild; original: PixelImage; albedoKey: string }> } {
  const commits: Array<{ build: MasksBuild; original: PixelImage; albedoKey: string }> = [];
  return {
    commits,
    askDescribe: vi.fn(async () => ({ ok: true as const, value: reply })),
    loadTable: async () => table,
    target: () => ({ size: 8, albedoKey: 'albedo-key', feather: DEFAULT_FEATHER }),
    commit: async (build, original, albedoKey) => {
      commits.push({ build, original, albedoKey });
      return true;
    },
    ...overrides,
  };
}
const live = new AbortController().signal;
const blob = new Blob(['x']);

describe('materialgen/masks createMasksSteps', () => {
  it('R1 R2 R7 the describe step asks with the albedo reference and returns the validated components', async () => {
    const bound = deps();
    const result = await createMasksSteps(bound).describeAlbedo(blob, 'mossy bricks', live);
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.components.map((component) => component.name)).toEqual(['Red brick', 'Steel plate', 'Moss']);
    expect(bound.askDescribe).toHaveBeenCalledOnce();
    expect(vi.mocked(bound.askDescribe).mock.calls[0]![0]).toContain('mossy bricks');
    expect(vi.mocked(bound.askDescribe).mock.calls[0]![1]).toBe(blob);
  });

  it('R8a the validated components are saved against the albedo as soon as the describe step returns', async () => {
    const saved: Array<{ albedoKey: string; names: string[] }> = [];
    const bound = deps({ pending: { load: () => null, save: async (albedoKey, components) => void saved.push({ albedoKey, names: components.map((component) => component.name) }) } });
    await createMasksSteps(bound).describeAlbedo(blob, '', live);
    expect(saved).toEqual([{ albedoKey: 'albedo-key', names: ['Red brick', 'Steel plate', 'Moss'] }]);
  });

  it('R8a a failed describe step saves nothing, and a failed save does not fail the step', async () => {
    const save = vi.fn(async () => undefined);
    const failed = deps({ askDescribe: async () => ({ ok: false, message: 'no key' }), pending: { load: () => null, save } });
    await createMasksSteps(failed).describeAlbedo(blob, '', live);
    expect(save).not.toHaveBeenCalled();
    const broken = deps({ pending: { load: () => null, save: async () => { throw new Error('disk full'); } } });
    expect((await createMasksSteps(broken).describeAlbedo(blob, '', live)).ok).toBe(true);
  });

  it('R8b saved components for this albedo are used and no describe call is made', async () => {
    const saved = answer.components.concat({ name: 'Moss', description: 'green moss', location: 'bottom' });
    const save = vi.fn(async () => undefined);
    const bound = deps({ pending: { load: (albedoKey) => (albedoKey === 'albedo-key' ? saved : null), save } });
    const result = await createMasksSteps(bound).describeAlbedo(blob, '', live);
    expect(result).toEqual({ ok: true, value: { components: saved } });
    expect(bound.askDescribe).not.toHaveBeenCalled();
    expect(save).not.toHaveBeenCalled();
  });

  it('R8b with no saved components for this albedo the call is made', async () => {
    const bound = deps({ pending: { load: () => null, save: async () => undefined } });
    await createMasksSteps(bound).describeAlbedo(blob, '', live);
    expect(bound.askDescribe).toHaveBeenCalledOnce();
  });

  it('R67 a describe failure (no key, no model) comes back as the message', async () => {
    const bound = deps({ askDescribe: async () => ({ ok: false, message: 'Add your OpenAI key in Settings > Keys' }) });
    expect(await createMasksSteps(bound).describeAlbedo(blob, '', live)).toEqual({ ok: false, message: 'Add your OpenAI key in Settings > Keys' });
  });

  it('R12 the decomposition prompt is the text of the components', () => {
    const text = createMasksSteps(deps()).buildDecompositionPrompt(answer);
    expect(text).toContain('Red brick');
    expect(text).toContain(palette[1]!.hex);
  });

  it('R14 R17 R41 R72 R77 accepting the picture builds the model masks, matches by keyword, and commits them with the picture as the original', async () => {
    const bound = deps();
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result).toEqual({ ok: true, value: undefined });
    expect(bound.commits).toHaveLength(1);
    const { build, original, albedoKey } = bound.commits[0]!;
    expect(build.record.source).toBe('model');
    expect(build.record.rows.map((row) => row.material)).toEqual(['Brick', 'Steel']);
    expect(build.record.rows.map((row) => row.matchKind)).toEqual(['keyword', 'keyword']);
    expect([original.width, original.height]).toEqual([16, 16]);
    expect(albedoKey).toBe('albedo-key');
    expect(build.labels.width).toBe(8);
  });

  it('R72 R74 with the vectors and an embedder the base materials are matched by meaning, not by words', async () => {
    const vectors = [Float32Array.of(1, 0, 0), Float32Array.of(0, 1, 0), Float32Array.of(0, 0, 1)]; // Brick, Steel, Moss
    const embedder = { embed: async (texts: string[]) => texts.map((text) => (text.includes('steel') ? Float32Array.of(0, 1, 0) : Float32Array.of(0, 0, 1))) };
    const bound = deps({ loadVectors: async () => vectors, embedder });
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result.ok).toBe(true);
    const { record } = bound.commits[0]!.build;
    expect(record.rows.map((row) => row.material)).toEqual(['Moss', 'Steel']); // the word "brick" would have said Brick
    expect(record.rows.map((row) => row.matchKind)).toEqual(['embedding', 'embedding']);
  });

  it('R76 the matching starts with the describe step, and accepting the picture uses its result without matching again', async () => {
    const vectors = [Float32Array.of(1, 0, 0), Float32Array.of(0, 1, 0), Float32Array.of(0, 0, 1)];
    const embed = vi.fn(async (texts: string[]) => texts.map(() => Float32Array.of(0, 0, 1)));
    const steps = createMasksSteps(deps({ loadVectors: async () => vectors, embedder: { embed } }));
    const described = await steps.describeAlbedo(blob, '', live);
    if (!described.ok) throw new Error('describe failed');
    await vi.waitFor(() => expect(embed).toHaveBeenCalled()); // before any picture exists
    const calls = embed.mock.calls.length;
    const accepted = await steps.acceptDecomposition(blob, decomposition(), described.value, live);
    expect(accepted.ok).toBe(true);
    expect(embed).toHaveBeenCalledTimes(calls);
  });

  it('R76 accepting a picture for components that were not described here still matches them', async () => {
    const embed = vi.fn(async (texts: string[]) => texts.map(() => Float32Array.of(0, 0, 1)));
    const bound = deps({ loadVectors: async () => [Float32Array.of(1, 0, 0), Float32Array.of(0, 1, 0), Float32Array.of(0, 0, 1)], embedder: { embed } });
    await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(embed).toHaveBeenCalled();
    expect(bound.commits[0]!.build.record.rows.map((row) => row.matchKind)).toEqual(['embedding', 'embedding']);
  });

  it('R77 vectors that cannot be loaded give the keyword match and no error', async () => {
    const bound = deps({ loadVectors: async () => { throw new Error('missing'); }, embedder: { embed: async () => { throw new Error('unused'); } } });
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result.ok).toBe(true);
    expect(bound.commits[0]!.build.record.rows.map((row) => row.matchKind)).toEqual(['keyword', 'keyword']);
  });

  it('R16 a picture that does not match the palette closely is still accepted and committed', async () => {
    const bound = deps();
    const grey: PixelImage = { width: 4, height: 4, channels: 3, data: new Uint8Array(48).fill(128) };
    const result = await createMasksSteps(bound).acceptDecomposition(blob, grey, answer, live);
    expect(result.ok).toBe(true);
    expect(bound.commits).toHaveLength(1);
  });

  it('R34 R67 a material list that cannot be loaded fails the step with a plain line', async () => {
    const bound = deps({ loadTable: async () => { throw new Error('missing'); } });
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result).toEqual({ ok: false, message: 'The material list could not be loaded.' });
  });

  it('R67 with no albedo or no size there is nothing to make labels for', async () => {
    const bound = deps({ target: () => null });
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result.ok).toBe(false);
    expect(bound.commits).toHaveLength(0);
  });

  it('R67 a commit that was not stored fails the step', async () => {
    const result = await createMasksSteps(deps({ commit: async () => false })).acceptDecomposition(blob, decomposition(), answer, live);
    expect(result).toEqual({ ok: false, message: 'The masks could not be stored.' });
  });

  it('R68 a cancelled step writes nothing', async () => {
    const controller = new AbortController();
    controller.abort();
    const bound = deps();
    const result = await createMasksSteps(bound).acceptDecomposition(blob, decomposition(), answer, controller.signal);
    expect(result.ok).toBe(false);
    expect(bound.commits).toHaveLength(0);
  });
});
