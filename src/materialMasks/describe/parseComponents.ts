/** One named part of the texture, as the describe step reports it (masks words). */
export interface Component {
  name: string;
  description: string;
  location: string;
}

export const MIN_COMPONENTS = 3;
export const MAX_COMPONENTS = 10;

/** How many components a describe reply may hold (material-masks-core R6). */
export interface ComponentLimits {
  min: number;
  max: number;
}
/** Material gen's limits, the default everywhere a `limits` parameter is optional. */
export const DEFAULT_COMPONENT_LIMITS: ComponentLimits = { min: MIN_COMPONENTS, max: MAX_COMPONENTS };

export type ParsedComponents =
  | { ok: true; components: Component[] }
  | { ok: false; problem: 'unparsable' | 'too-few' | 'too-many'; hint: string };

const countHint = ({ min, max }: ComponentLimits): string => `Return between ${min} and ${max} components.`;
const JSON_HINT = 'Return only the JSON array of components.';

function parseLoose(text: string): unknown {
  const attempts: string[] = [text.trim()];
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(text);
  if (fenced?.[1] !== undefined) attempts.push(fenced[1].trim());
  for (const attempt of attempts) {
    try {
      return JSON.parse(attempt);
    } catch {
      // try the next shape
    }
  }
  for (const [open, close] of [['[', ']'], ['{', '}']] as const) {
    const start = text.indexOf(open);
    const end = text.lastIndexOf(close);
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(text.slice(start, end + 1));
      } catch {
        // nothing usable between these marks
      }
    }
  }
  return undefined;
}

/** The list inside a reply: the value itself when it is an array, else the first array held by an object. */
function findList(value: unknown): unknown[] | null {
  if (Array.isArray(value)) return value;
  if (value !== null && typeof value === 'object') {
    for (const inner of Object.values(value)) if (Array.isArray(inner)) return inner;
  }
  return null;
}

const text = (value: unknown): string => (typeof value === 'string' ? value.trim() : '');

/**
 * Masks R3, R4, R6: reads the describe reply tolerantly (code fences and chatter ignored, an array or an object holding one, extra fields
 * dropped, strings trimmed), repairs names and missing texts, then checks the count. A failure carries the sentence the one retry adds (R7).
 */
export function parseComponents(reply: string, limits: ComponentLimits = DEFAULT_COMPONENT_LIMITS): ParsedComponents {
  const list = findList(parseLoose(reply));
  const entries = list?.filter((entry): entry is Record<string, unknown> => entry !== null && typeof entry === 'object' && !Array.isArray(entry));
  if (entries === undefined || entries.length === 0) return { ok: false, problem: 'unparsable', hint: JSON_HINT };
  const used = new Set<string>();
  const components = entries.map((entry, position): Component => {
    const base = text(entry['name']) || `Component ${position + 1}`;
    let name = base;
    for (let copy = 2; used.has(name); copy += 1) name = `${base} ${copy}`;
    used.add(name);
    return { name, description: text(entry['description']), location: text(entry['location']) };
  });
  if (components.length < limits.min) return { ok: false, problem: 'too-few', hint: countHint(limits) };
  if (components.length > limits.max) return { ok: false, problem: 'too-many', hint: countHint(limits) };
  return { ok: true, components };
}
