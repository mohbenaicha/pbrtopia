import type { ReactNode } from 'react';

// A marked run starts and ends on a non-space, so "2 * 3 * 4" is not italic.
const MARKED = /(\*\*[^*\s](?:[^*]*[^*\s])?\*\*|\*[^*\s](?:[^*]*[^*\s])?\*)/g;

/** A paragraph of the words as React nodes: `**bold**` is strong, `*italic*` is em, everything else is plain text. Never HTML (tutorial R9). */
export function renderInlineMarkup(paragraph: string): ReactNode[] {
  return paragraph.split(MARKED).map((part, index) => {
    if (part.startsWith('**') && part.endsWith('**') && part.length > 4) return <strong key={index}>{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*') && part.length > 2) return <em key={index}>{part.slice(1, -1)}</em>;
    return part;
  });
}
