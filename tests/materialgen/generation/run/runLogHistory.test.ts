import { describe, expect, it } from 'vitest';
import { MAX_LOGGED_RUNS, recordRetry, recordRun, type RunLogRow } from '@mat/generation/run/runLogHistory';
import type { ImageAttempt, RunReport } from '@mat/generation/run/runTypes';

const attempt = (status: ImageAttempt['status'], prompt = 'p'): ImageAttempt => ({
  jobId: 'image-1', label: 'Image 1 (Albedo)', maps: ['Albedo'], model: 'm', resolutionKey: '1K', quality: null, canvas: '1024 x 1024', layout: '1x1', tilePx: 1024,
  referenceNames: [], prompt, status, durationMs: 5, mimeType: null, returnedSize: null, note: null, error: null, thumbnail: null,
});
const report = (status: RunReport['status'], attempts: ImageAttempt[]): RunReport => ({
  status, message: status === 'done' ? 'Generated: Albedo' : 'Generated 0 of 1 images', committed: [], failures: [], attempts, describeAttempt: null,
  checkpoint: { plan: { images: [], decomposition: null }, userText: '', colorMode: 'albedo', references: [], finished: [], albedoReference: null, describe: null }, packedWarning: false,
});
const row = (id: string) => ({ id, startedAt: 1, userText: 'brick', planSummary: 'Preset 1' });

describe('materialgen/generation R68 R69 run log', () => {
  it('R68 a run becomes the newest row with its text, plan summary, attempts and outcome', () => {
    const history = recordRun([], row('a'), report('done', [attempt('done')]));
    expect(history[0]).toMatchObject({ id: 'a', userText: 'brick', planSummary: 'Preset 1', message: 'Generated: Albedo', status: 'done' });
    expect(history[0]!.attempts).toHaveLength(1);
  });

  it('R68 the log keeps the last ten runs, newest first', () => {
    let history: RunLogRow[] = [];
    for (let index = 0; index < 12; index += 1) history = recordRun(history, row(`run-${index}`), report('done', [attempt('done')]));
    expect(history).toHaveLength(MAX_LOGGED_RUNS);
    expect(history[0]!.id).toBe('run-11');
    expect(history.at(-1)!.id).toBe('run-2');
  });

  it('R69 a retried run keeps both attempts, the failed one and the retry, each with its prompt', () => {
    const first = recordRun([], row('a'), report('failed', [attempt('failed', 'prompt one')]));
    const after = recordRetry(first, 'a', report('done', [attempt('done', 'prompt one')]));
    expect(after[0]!.attempts.map((entry) => entry.status)).toEqual(['failed', 'done']);
    expect(after[0]!.attempts.every((entry) => entry.prompt === 'prompt one')).toBe(true);
    expect(after[0]!.status).toBe('done');
    expect(after[0]!.message).toBe('Generated: Albedo');
  });

  it('R69 a retry of a row that left the log changes nothing', () => {
    const history = recordRun([], row('a'), report('failed', [attempt('failed')]));
    expect(recordRetry(history, 'gone', report('done', [attempt('done')]))).toEqual(history);
  });
});
