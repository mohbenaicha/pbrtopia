import { parseComponents, type Component } from '../describe/parseComponents';
import { buildDescribeText } from './describeInstruction';
import type { StepOutcome } from './stepOutcome';

interface DescribeStepInput {
  /** Sends the text (with the albedo reference the caller holds) to the describe model and answers with its reply text. */
  ask(text: string): Promise<StepOutcome<string>>;
  userText: string;
  signal: AbortSignal;
}

const CANCELLED = 'Cancelled.';
const INVALID = 'The describe model did not return a usable list of components.';

/**
 * Masks R1-R7, R67, R68: one call, read tolerantly; when the reply is not a valid list the call is repeated once with the same text plus the
 * sentence that says what was wrong. A provider failure ends the step at once (the caller's message is kept), and a cancelled step makes no
 * further call. At most 2 calls.
 */
export async function runDescribeStep({ ask, userText, signal }: DescribeStepInput): Promise<StepOutcome<Component[]>> {
  const text = buildDescribeText(userText);
  let sent = text;
  for (let attempt = 0; attempt < 2; attempt += 1) {
    const reply = await ask(sent);
    if (signal.aborted) return { ok: false, message: CANCELLED };
    if (!reply.ok) return reply;
    const parsed = parseComponents(reply.value);
    if (parsed.ok) return { ok: true, value: parsed.components };
    if (attempt === 1) return { ok: false, message: INVALID };
    sent = `${text}\n\n${parsed.hint}`;
  }
  return { ok: false, message: INVALID };
}
