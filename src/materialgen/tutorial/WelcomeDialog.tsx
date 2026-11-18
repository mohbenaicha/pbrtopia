import { useEffect, useRef, useState } from 'react';
import { renderInlineMarkup, parseTutorialText } from '@shared/tutorial';
import { Button, Dialog, Icon } from '@shared/ui-kit';
import { buildAgentSetupPrompt } from './agentSetupPrompt';
import { GITHUB_URL, WEB_APP_URL, WELCOME_LINKS } from './welcomeLinks';
import welcomeSource from './welcome-text.md?raw';
import './welcome.css';

const TEXTS = parseTutorialText(welcomeSource);
const COPY_FEEDBACK_MS = 2000;
type CopyState = 'idle' | 'copied' | 'failed';
const COPY_LABEL: Record<CopyState, string> = { idle: 'Copy instructions for an agent', copied: 'Copied', failed: 'Copy failed' };

interface WelcomeDialogProps {
  open: boolean;
  onStartTour: () => void;
  onGenerateMaterial: () => void;
  onClose: () => void; // Esc
}

function Part({ id }: { id: string }): React.JSX.Element | null {
  const text = TEXTS[id];
  if (text === undefined) return null;
  return (
    <section className="welcome__part">
      <h3 className="welcome__heading">{text.heading}</h3>
      {text.paragraphs.map((paragraph) => (
        <p key={paragraph} className="welcome__words">{renderInlineMarkup(paragraph, WELCOME_LINKS)}</p>
      ))}
    </section>
  );
}

/** Tutorial R14-R16: the first-launch welcome: what the app does and needs, where to get it, the privacy facts, and the two ways in. */
export function WelcomeDialog({ open, onStartTour, onGenerateMaterial, onClose }: WelcomeDialogProps): React.JSX.Element | null {
  const [copy, setCopy] = useState<CopyState>('idle');
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  useEffect(() => () => clearTimeout(timer.current), []);

  const copyInstructions = async (): Promise<void> => {
    let next: CopyState = 'copied';
    try {
      await navigator.clipboard.writeText(buildAgentSetupPrompt(GITHUB_URL));
    } catch {
      next = 'failed'; // a refused or missing clipboard changes nothing else (R16)
    }
    setCopy(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => setCopy('idle'), COPY_FEEDBACK_MS);
  };

  return (
    <Dialog
      open={open}
      title={TEXTS.title?.heading ?? 'Welcome'}
      size="wide"
      closeOnOutsideClick={false}
      onClose={onClose}
      actions={
        <>
          <Button variant="primary" onClick={onStartTour}>Start with tutorial</Button>
          <Button onClick={onGenerateMaterial}>Generate material</Button>
        </>
      }
    >
      <div className="welcome">
        <Part id="what" />
        <Part id="needs" />
        <Part id="where" />
        <div className="welcome__links">
          <a className="welcome__link" href={WEB_APP_URL} target="_blank" rel="noopener noreferrer">www.pbrtopia.com</a>
          <a className="welcome__link" href={GITHUB_URL} target="_blank" rel="noopener noreferrer">
            <Icon name="github" size={18} />
            GitHub
          </a>
          <Button onClick={() => void copyInstructions()}>{COPY_LABEL[copy]}</Button>
        </div>
        <Part id="privacy" />
      </div>
    </Dialog>
  );
}
