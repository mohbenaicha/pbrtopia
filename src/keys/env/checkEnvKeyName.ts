import type { EnvKeySource } from './envKeyTypes';

export type EnvNameCheck = { status: 'found' } | { status: 'failed'; message: string };

const UNAVAILABLE_MESSAGE = 'Could not read the environment.';
const RESTART_SENTENCE = 'If you just set it, restart the app.';

/** Api-keys R16: whether `name` can be found. Reads once and drops the value; the answer never carries it; no rule applies to the name or the value (R15). */
export async function checkEnvKeyName(source: EnvKeySource, name: string): Promise<EnvNameCheck> {
  const answer = await source.read(name);
  if (answer.ok) return { status: 'found' };
  if (answer.reason === 'unavailable') return { status: 'failed', message: UNAVAILABLE_MESSAGE };
  return { status: 'failed', message: `"${name}" is not set.${source.needsRestart ? ` ${RESTART_SENTENCE}` : ''}` };
}
