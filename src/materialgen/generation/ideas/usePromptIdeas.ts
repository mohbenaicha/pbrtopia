import { useCallback, useEffect, useRef, useState } from 'react';
import type { DescribeTarget } from '../ui/bindRunPorts';
import { requestPromptIdeas, type IdeasBackends } from './requestPromptIdeas';
import { canReset, EMPTY_IDEAS, pickIdea, receiveIdeas, resetToPrevious, selectedIdea, type IdeasState } from './promptTrail';

export const NO_PROMPT_REASON = 'Write a prompt first';
export const NO_ENHANCER_KEY_REASON = 'Add an OpenAI or Gemini key in Settings > Keys';
export const NOTHING_TO_GO_BACK_TO = 'Nothing to go back to';

export interface PromptIdeas {
  ideas: readonly string[]; // the set now offered, empty before the first one
  selected: number | null; // the idea the field shows exactly (R73)
  canReset: boolean; // R74
  busy: boolean;
  error: string | null; // R72: one line under the field
  disabledReason: string | null; // why Get prompt ideas cannot start now (R71); the read-only reason is the panel's (R75)
  request(): void;
  pick(index: number): void;
  reset(): void;
}

interface Inputs {
  prompt: string;
  setPrompt(text: string): void;
  target: DescribeTarget | null; // the enhancer model with its level (settings R5), null without any key
  backends: IdeasBackends;
}

/** Generation R71-R75: the set of ideas, the pick and the reset trail, in memory with the panel; the call itself is `requestPromptIdeas`. */
export function usePromptIdeas({ prompt, setPrompt, target, backends }: Inputs): PromptIdeas {
  const [state, setState] = useState<IdeasState>(EMPTY_IDEAS);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const latest = useRef({ prompt, target, backends });
  latest.current = { prompt, target, backends };
  const running = useRef<AbortController | null>(null);

  useEffect(() => () => running.current?.abort(), []); // R72: leaving the project aborts the request

  const disabledReason = prompt.trim() === '' ? NO_PROMPT_REASON : target === null ? NO_ENHANCER_KEY_REASON : null;

  const request = useCallback((): void => {
    const { prompt: asked, target: model, backends: deps } = latest.current;
    if (model === null || asked.trim() === '' || running.current !== null) return;
    const controller = new AbortController();
    running.current = controller;
    setBusy(true);
    setError(null);
    void requestPromptIdeas(model, asked, deps, controller.signal).then((outcome) => {
      running.current = null;
      if (controller.signal.aborted) return;
      setBusy(false);
      if (outcome.kind === 'ideas') setState((current) => receiveIdeas(current, outcome.ideas));
      else if (outcome.kind === 'error') setError(outcome.message);
    });
  }, []);

  const pick = useCallback(
    (index: number): void => {
      const picked = pickIdea(state, latest.current.prompt, index);
      setState(picked.state);
      setError(null);
      setPrompt(picked.text);
    },
    [state, setPrompt],
  );

  const reset = useCallback((): void => {
    const back = resetToPrevious(state);
    if (back === null) return;
    setState(back.state);
    setError(null);
    setPrompt(back.text);
  }, [state, setPrompt]);

  return { ideas: state.ideas, selected: selectedIdea(state, prompt), canReset: canReset(state), busy, error, disabledReason, request, pick, reset };
}
