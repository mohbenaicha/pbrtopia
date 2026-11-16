import { NOTHING_TO_GO_BACK_TO, type PromptIdeas } from '@mat/generation';
import { Icon, IconButton } from '@shared/ui-kit';

const NUMBERS = [1, 2, 3] as const;

interface PromptIdeasStripProps {
  ideas: PromptIdeas;
  readOnlyReason: string | null; // why every control is off when the project is open in another tab (R75), else null
}

const because = (reason: string | null): { disabled: boolean; disabledReason?: string } => (reason === null ? { disabled: false } : { disabled: true, disabledReason: reason });

/**
 * Materialgen generation R71-R75: the strip inside the Prompt field's bottom edge. The AI mark (Get prompt ideas) is always there; Reset and the numbers 1 to 3 appear once a set of ideas
 * exists. A number shows its idea in full on hover and puts it in the field on click.
 */
export function PromptIdeasStrip({ ideas, readOnlyReason }: PromptIdeasStripProps): React.JSX.Element {
  const hasSet = ideas.ideas.length > 0;
  return (
    <div className="prompt-ideas" data-tutorial="generate-ideas" role="group" aria-label="Prompt ideas">
      {hasSet && (
        <>
          <IconButton label="Reset" hint="Puts back what you wrote before the ideas." icon={<Icon name="reset" />} {...because(readOnlyReason ?? (ideas.canReset ? null : NOTHING_TO_GO_BACK_TO))} onClick={ideas.reset} />
          {NUMBERS.map((number, index) => (
            <IconButton
              key={number}
              label={`Idea ${number}`}
              hint={ideas.ideas[index] ?? ''}
              icon={<span className="prompt-ideas__number">{number}</span>}
              pressed={ideas.selected === index}
              {...because(readOnlyReason)}
              onClick={() => ideas.pick(index)}
            />
          ))}
        </>
      )}
      <IconButton label="Get prompt ideas" icon={<Icon name="sparkle" />} loading={ideas.busy} {...because(readOnlyReason ?? ideas.disabledReason)} onClick={ideas.request} />
    </div>
  );
}
