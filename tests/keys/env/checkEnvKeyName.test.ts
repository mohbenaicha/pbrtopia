import { describe, expect, it } from 'vitest';
import { checkEnvKeyName } from '../../../src/keys/env/checkEnvKeyName';
import { createFakeEnvKeySource } from './fakeEnvKeySource';

describe('keys/env checkEnvKeyName', () => {
  it('R16 a set variable is found, with no length rule, after one read', async () => {
    const source = createFakeEnvKeySource({ GEMINI_API_KEY: 'abc' });
    expect(await checkEnvKeyName(source, 'GEMINI_API_KEY')).toEqual({ status: 'found' });
    expect(source.reads).toEqual(['GEMINI_API_KEY']);
  });

  it('R16 the answer never carries the value', async () => {
    const source = createFakeEnvKeySource({ GEMINI_API_KEY: 'SECRET-VALUE-123' });
    expect(JSON.stringify(await checkEnvKeyName(source, 'GEMINI_API_KEY'))).not.toContain('SECRET-VALUE-123');
  });

  it('R16 an unset variable says so, with no restart sentence on a host that reads fresh', async () => {
    const answer = await checkEnvKeyName(createFakeEnvKeySource({}), 'GEMINI_API_KEY');
    expect(answer).toEqual({ status: 'failed', message: '"GEMINI_API_KEY" is not set.' });
  });

  it('R16 an unset variable on the desktop app adds the restart sentence', async () => {
    const answer = await checkEnvKeyName(createFakeEnvKeySource({}, { needsRestart: true }), 'GEMINI_API_KEY');
    expect(answer).toEqual({ status: 'failed', message: '"GEMINI_API_KEY" is not set. If you just set it, restart the app.' });
  });

  it('R16 an empty variable counts as not set', async () => {
    const answer = await checkEnvKeyName(createFakeEnvKeySource({ OPENAI_API_KEY: '' }), 'OPENAI_API_KEY');
    expect(answer).toEqual({ status: 'failed', message: '"OPENAI_API_KEY" is not set.' });
  });

  it('R16 a host that cannot be reached says so', async () => {
    const answer = await checkEnvKeyName(createFakeEnvKeySource({ X_KEY: 'v' }, { failReads: true }), 'X_KEY');
    expect(answer).toEqual({ status: 'failed', message: 'Could not read the environment.' });
  });

  it('R15 any name is looked up as typed, with no rule on its form', async () => {
    const source = createFakeEnvKeySource({ PATH: 'c:\\', 'my token': 'v' });
    expect(await checkEnvKeyName(source, 'PATH')).toEqual({ status: 'found' });
    expect(await checkEnvKeyName(source, 'my token')).toEqual({ status: 'found' });
    expect(source.reads).toEqual(['PATH', 'my token']);
  });
});
