/** One step's words: a heading and paragraphs that may carry `**bold**` and `*italic*` (tutorial R9). */
export interface StepText {
  heading: string;
  paragraphs: string[];
}

/**
 * Reads the words file: a line `## <step id> | <heading>` opens a step, the lines under it are its body, a blank line starts a new paragraph, and anything
 * before the first step line is a comment. Throws on a step given twice or without a heading, so a hand edit cannot silently lose words (tutorial R9).
 */
export function parseTutorialText(raw: string): Record<string, StepText> {
  const texts: Record<string, StepText> = {};
  let current: { id: string; heading: string; lines: string[] } | null = null;

  const close = (): void => {
    if (current === null) return;
    const paragraphs = current.lines
      .join('\n')
      .split(/\n\s*\n/)
      .map((paragraph) => paragraph.replace(/\s*\n\s*/g, ' ').trim())
      .filter((paragraph) => paragraph !== '');
    texts[current.id] = { heading: current.heading, paragraphs };
  };

  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith('## ')) {
      current?.lines.push(line);
      continue;
    }
    close();
    const separator = line.indexOf('|');
    const id = (separator === -1 ? line.slice(3) : line.slice(3, separator)).trim();
    const heading = separator === -1 ? '' : line.slice(separator + 1).trim();
    if (heading === '') throw new Error(`Tutorial text: step "${id}" has no heading (write "## id | Heading").`);
    if (id in texts) throw new Error(`Tutorial text: step "${id}" is given twice.`);
    current = { id, heading, lines: [] };
  }
  close();
  return texts;
}
