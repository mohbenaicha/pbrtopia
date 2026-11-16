import { createContext, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { forgetOpenProject } from '@shared/shell';
import { TourController, TourLayer, closeReveal, createTourSeenStorage, openReveal, parseTutorialText } from '@shared/tutorial';
import type { MaterialProjectStore } from '@mat/storage';
import { BUNDLED_SAMPLES } from '../samples/bundledSamples';
import { findSampleProjectId } from './findSampleProjectId';
import { createMaterialTourStage } from './materialTourStage';
import { TUTORIAL_SECTIONS } from './tutorialSteps';
import { WelcomeDialog } from './WelcomeDialog';
import tutorialSource from './tutorial-text.md?raw';

/** Where the "seen" flag is kept (tutorial R2). */
export const TUTORIAL_SEEN_KEY = 'material-lab.tutorial.done';

export interface TutorialLauncher {
  start(): void;
}

const NO_TUTORIAL: TutorialLauncher = { start: () => undefined };
const LauncherContext = createContext<TutorialLauncher>(NO_TUTORIAL);

/** The Tutorial buttons start the tour through this. */
export const useTutorialLauncher = (): TutorialLauncher => useContext(LauncherContext);

interface MaterialTutorialProps {
  store: Pick<MaterialProjectStore, 'listProjects' | 'saveAppSettings'>;
  /** The app is ready to be toured: the samples are imported and the project list shows (tutorial R2). */
  ready: boolean;
  /** The welcome's "Generate material": the app opens its New project dialog (tutorial R15). */
  onGenerateMaterial: () => void;
  children: ReactNode;
}

/** Tutorial R1, R2, R14, R15: owns the tour and the first-launch welcome, draws the tour's layer over the app, and shows the welcome by itself once. */
export function MaterialTutorial({ store, ready, onGenerateMaterial, children }: MaterialTutorialProps): React.JSX.Element {
  const seen = useMemo(() => createTourSeenStorage(TUTORIAL_SEEN_KEY), []);
  const controller = useMemo(
    () =>
      new TourController({
        sections: TUTORIAL_SECTIONS,
        texts: parseTutorialText(tutorialSource),
        stage: createMaterialTourStage({
          findSampleId: () => findSampleProjectId(store, BUNDLED_SAMPLES.map((sample) => sample.name)),
          currentHash: () => window.location.hash,
          goTo: (hash) => {
            window.location.hash = hash;
          },
          forgetOpenProject: () => forgetOpenProject(store),
          openReveal,
          closeReveal,
        }),
      }),
    [store],
  );
  const [welcomeOpen, setWelcomeOpen] = useState(false);
  const launcher = useMemo<TutorialLauncher>(
    () => ({
      start: () => {
        setWelcomeOpen(false); // the welcome and the tour are never both on screen (R18)
        controller.start();
      },
    }),
    [controller],
  );
  useEffect(() => {
    if (!ready || seen.read()) return;
    seen.write(); // saved the moment the welcome shows, whatever happens next (R2)
    setWelcomeOpen(true);
  }, [ready, seen]);

  return (
    <LauncherContext.Provider value={launcher}>
      {children}
      <WelcomeDialog
        open={welcomeOpen}
        onStartTour={launcher.start}
        onGenerateMaterial={() => {
          setWelcomeOpen(false);
          onGenerateMaterial();
        }}
        onClose={() => setWelcomeOpen(false)}
      />
      <TourLayer controller={controller} />
    </LauncherContext.Provider>
  );
}
