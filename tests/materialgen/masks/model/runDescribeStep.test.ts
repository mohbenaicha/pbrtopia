import { describe, expect, it } from 'vitest';
import { DESCRIBE_INSTRUCTION, runDescribeStep, type StepOutcome } from '@mat/masks';

const three = JSON.stringify([
  { name: 'Gold', description: 'shiny', location: 'top' },
  { name: 'Red', description: 'paint', location: 'left' },
  { name: 'Stone', description: 'grey', location: 'bottom' },
]);
const twelve = JSON.stringify(Array.from({ length: 12 }, (_, at) => ({ name: `Part ${at}`, description: '', location: '' })));

/** An asker that answers from a list, in order, and remembers what it was asked. */
function scripted(replies: Array<StepOutcome<string>>): { ask: (text: string) => Promise<StepOutcome<string>>; asked: string[] } {
  const asked: string[] = [];
  return {
    asked,
    ask: async (text) => {
      asked.push(text);
      return replies[Math.min(asked.length - 1, replies.length - 1)]!;
    },
  };
}
const live = new AbortController().signal;

describe('materialgen/masks runDescribeStep', () => {
  it('R1 R2 the first call holds the fixed instruction first, then the user prompt', async () => {
    const script = scripted([{ ok: true, value: three }]);
    const result = await runDescribeStep({ ask: script.ask, userText: 'mossy bricks', signal: live });
    expect(result.ok).toBe(true);
    expect(script.asked).toHaveLength(1);
    expect(script.asked[0]!.startsWith(DESCRIBE_INSTRUCTION)).toBe(true);
    expect(script.asked[0]!.endsWith('mossy bricks')).toBe(true);
  });

  it('R2 the instruction asks for JSON only with name, description and location, 3 to 10 components', () => {
    for (const word of ['JSON', 'name', 'description', 'location', '3', '10']) expect(DESCRIBE_INSTRUCTION).toContain(word);
  });

  it('R1 an empty prompt adds nothing after the instruction', async () => {
    const script = scripted([{ ok: true, value: three }]);
    await runDescribeStep({ ask: script.ask, userText: '  ', signal: live });
    expect(script.asked[0]).toBe(DESCRIBE_INSTRUCTION);
  });

  it('R3 R4 a reply in a code fence with chatter is read and a missing name is repaired', async () => {
    const reply = 'Sure! ```json\n[{"description":"a","location":"b"},{"name":"B"},{"name":"C"}]\n```';
    const result = await runDescribeStep({ ask: scripted([{ ok: true, value: reply }]).ask, userText: '', signal: live });
    expect(result).toEqual({
      ok: true,
      value: [
        { name: 'Component 1', description: 'a', location: 'b' },
        { name: 'B', description: '', location: '' },
        { name: 'C', description: '', location: '' },
      ],
    });
  });

  it('R6 R7 twelve components fail once; the retry repeats the request plus one sentence', async () => {
    const script = scripted([{ ok: true, value: twelve }, { ok: true, value: three }]);
    const result = await runDescribeStep({ ask: script.ask, userText: 'bricks', signal: live });
    expect(result.ok).toBe(true);
    expect(script.asked).toHaveLength(2);
    expect(script.asked[1]).toBe(`${script.asked[0]}\n\nReturn between 3 and 10 components.`);
  });

  it('R7 R67 a second failure ends the step with a message naming the problem, after two calls only', async () => {
    const script = scripted([{ ok: true, value: 'no json here' }]);
    const result = await runDescribeStep({ ask: script.ask, userText: '', signal: live });
    expect(script.asked).toHaveLength(2);
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.message).toMatch(/describe/i);
  });

  it('R67 a provider failure ends the step at once with the provider message and no retry', async () => {
    const script = scripted([{ ok: false, message: 'The key was refused.' }]);
    const result = await runDescribeStep({ ask: script.ask, userText: '', signal: live });
    expect(script.asked).toHaveLength(1);
    expect(result).toEqual({ ok: false, message: 'The key was refused.' });
  });

  it('R68 a cancelled step makes no further call', async () => {
    const controller = new AbortController();
    const asked: string[] = [];
    const result = await runDescribeStep({
      ask: async (text) => {
        asked.push(text);
        controller.abort();
        return { ok: true, value: 'bad' };
      },
      userText: '',
      signal: controller.signal,
    });
    expect(asked).toHaveLength(1);
    expect(result.ok).toBe(false);
  });
});
