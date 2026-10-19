import { useState } from 'react';
import { Disclosure } from '../../ui-kit';

// R12: the prompt the enhancer wrote, as plain text. Nothing while there is none.
export function EnhancedPromptBlock({ text }: { text: string | null }): React.JSX.Element | null {
  const [open, setOpen] = useState(true);
  if (text === null || text === '') return null;
  return (
    <Disclosure title="Enhanced prompt" open={open} onOpenChange={setOpen}>
      <p className="enhanced-prompt">{text}</p>
    </Disclosure>
  );
}
