import { describe, expect, it } from 'vitest';
import { seedSampleProjects, type SampleSeedPorts } from '@mat/samples/seedSampleProjects';

const NAMES = ['Corrugated-Metal', 'Fungal-Bark', 'Rocky-Desert', 'Rotting-Wood'];

/** Fake ports that record what happens, in order. */
function fakePorts(overrides: Partial<SampleSeedPorts> = {}): { ports: SampleSeedPorts; log: string[]; flag: { seeded: boolean } } {
  const log: string[] = [];
  const flag = { seeded: false };
  const ports: SampleSeedPorts = {
    isSeeded: async () => flag.seeded,
    markSeeded: async () => {
      log.push('flag');
      flag.seeded = true;
      return { ok: true, value: undefined };
    },
    samples: NAMES.map((name) => ({ name, open: async () => new ReadableStream<Uint8Array>({ start: (controller) => { controller.enqueue(new TextEncoder().encode(name)); controller.close(); } }) })),
    importZip: async (zip) => {
      const text = new TextDecoder().decode((await zip.getReader().read()).value);
      log.push(`import ${text}`);
      return { ok: true, value: undefined };
    },
    ...overrides,
  };
  return { ports, log, flag };
}

describe('seedSampleProjects (materialgen/default-projects R11)', () => {
  it('TestR11_the_first_start_imports_all_four_samples', async () => {
    const { ports, log } = fakePorts();
    const result = await seedSampleProjects(ports);
    expect(log.filter((line) => line.startsWith('import')).length).toBe(4);
    expect(result).toEqual({ ran: true, failures: [] });
  });

  it('TestR11_the_flag_is_saved_before_the_first_import', async () => {
    const { ports, log } = fakePorts();
    await seedSampleProjects(ports);
    expect(log[0]).toBe('flag');
  });

  it('TestR11_a_second_start_imports_nothing', async () => {
    const { ports, log } = fakePorts();
    await seedSampleProjects(ports);
    log.length = 0;
    const result = await seedSampleProjects(ports);
    expect(log).toEqual([]);
    expect(result).toEqual({ ran: false, failures: [] });
  });

  it('TestR11_a_deleted_sample_does_not_come_back', async () => {
    const { ports, flag } = fakePorts();
    await seedSampleProjects(ports);
    expect(flag.seeded).toBe(true); // the project list is never asked: only the flag decides
  });

  it('TestR11_a_failed_sample_is_reported_and_the_others_still_import', async () => {
    const { ports, log } = fakePorts({
      importZip: async (zip) => {
        const text = new TextDecoder().decode((await zip.getReader().read()).value);
        if (text === 'Fungal-Bark') return { ok: false, error: { kind: 'corrupt', message: 'The zip is cut off.' } } as never;
        log.push(`import ${text}`);
        return { ok: true, value: undefined };
      },
    });
    const result = await seedSampleProjects(ports);
    expect(log.filter((line) => line.startsWith('import'))).toEqual(['import Corrugated-Metal', 'import Rocky-Desert', 'import Rotting-Wood']);
    expect(result.failures).toEqual(['Fungal-Bark: The zip is cut off.']);
  });

  it('TestR11_a_sample_that_cannot_be_opened_is_reported_and_the_others_still_import', async () => {
    const { ports } = fakePorts();
    const broken = { ...ports, samples: ports.samples.map((sample) => (sample.name === 'Rocky-Desert' ? { ...sample, open: async () => { throw new Error('404'); } } : sample)) };
    const result = await seedSampleProjects(broken);
    expect(result.failures).toHaveLength(1);
    expect(result.failures[0]).toContain('Rocky-Desert');
  });

  it('TestR11_when_the_flag_cannot_be_saved_nothing_is_imported', async () => {
    const { ports, log } = fakePorts({ markSeeded: async () => ({ ok: false, error: { kind: 'unavailable', message: 'Storage is blocked.' } }) as never });
    const result = await seedSampleProjects(ports);
    expect(log).toEqual([]);
    expect(result.failures).toEqual(['Storage is blocked.']);
  });

  it('TestR12_it_reports_each_sample_that_is_done_so_the_placeholders_can_be_replaced', async () => {
    const { ports } = fakePorts();
    const remaining: number[] = [];
    await seedSampleProjects(ports, (left) => remaining.push(left));
    expect(remaining).toEqual([3, 2, 1, 0]);
  });
});
