import { Button, Icon, IconButton } from '@shared/ui-kit';
import { useTutorialLauncher } from './MaterialTutorial';

const HINT = 'Walks you through the app, one step at a time.';

/** Tutorial R1: the top bar's icon button, beside Add-ons. */
export function TutorialButton(): React.JSX.Element {
  const { start } = useTutorialLauncher();
  return <IconButton label="Tutorial" hint={HINT} icon={<Icon name="help" />} onClick={start} />;
}

/** The same start on the project list, which has no top bar. */
export function TutorialListButton(): React.JSX.Element {
  const { start } = useTutorialLauncher();
  return (
    <Button icon={<Icon name="help" size={26} />} title={HINT} onClick={start}>
      Tutorial
    </Button>
  );
}
