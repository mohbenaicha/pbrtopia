import type { StoreResult } from '@shared/projects';

// Materialgen/default-projects R11, R12: the first start of the app imports the bundled sample projects, once.

export interface SampleSource {
  name: string;
  open(): Promise<ReadableStream<Uint8Array>>; // the bundled zip
}

export interface SampleSeedPorts {
  isSeeded(): Promise<boolean>; // the flag in the app settings
  markSeeded(): Promise<StoreResult<void>>;
  samples: readonly SampleSource[];
  importZip(zip: ReadableStream<Uint8Array>): Promise<StoreResult<unknown>>; // the ordinary project import
}

export interface SampleSeedOutcome {
  ran: boolean; // false when an earlier start already did it
  failures: string[]; // one line per sample that did not come in, or the reason nothing was tried
}

/**
 * The flag is saved before the first import, so a start that is cut short never repeats a sample and a deleted sample never returns (R11). A sample that
 * fails is reported and the others still come in. `onSampleDone(remaining)` is called after each sample, whatever its outcome (R12).
 */
export async function seedSampleProjects(ports: SampleSeedPorts, onSampleDone?: (remaining: number) => void): Promise<SampleSeedOutcome> {
  if (await ports.isSeeded()) return { ran: false, failures: [] };
  const marked = await ports.markSeeded();
  if (!marked.ok) return { ran: true, failures: [marked.error.message] };
  const failures: string[] = [];
  for (const [position, sample] of ports.samples.entries()) {
    try {
      const imported = await ports.importZip(await sample.open());
      if (!imported.ok) failures.push(`${sample.name}: ${imported.error.message}`);
    } catch (error) {
      failures.push(`${sample.name}: ${error instanceof Error ? error.message : 'could not be opened'}`);
    }
    onSampleDone?.(ports.samples.length - position - 1);
  }
  return { ran: true, failures };
}
