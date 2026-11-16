import { createContext, useContext, useEffect, useMemo, type ReactNode } from 'react';
import { forgetOpenProject } from '@shared/shell';
import { TourController, TourLayer, closeReveal, createTourSeenStorage, openReveal, parseTutorialText } from '@shared/tutorial';
import type { MaterialProjectStore } from '@mat/storage';
import { BUNDLED_SAMPLES } from '../samples/bundledSamples';
import { findSampleProjectId } from './findSampleProjectId';
import { createMaterialTourStage } from './materialTourStage';
import { TUTORIAL_SECTIONS } from './tutorialSteps';
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
  children: ReactNode;
}

/** Tutorial R1, R2: owns the tour, draws its layer over the app, and starts it by itself once, on the first launch. */
export function MaterialTutorial({ store, ready, children }: MaterialTutorialProps): React.JSX.Element {
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
  const launcher = useMemo<TutorialLauncher>(
    () => ({
      start: () => {
        seen.write(); // saved the moment the tour starts, whatever happens next (R2)
        controller.start();
      },
    }),
    [seen, controller],
  );
  useEffect(() => {
    if (ready && !seen.read()) launcher.start();
  }, [ready, seen, launcher]);

  return (
    <LauncherContext.Provider value={launcher}>
      {children}
      <TourLayer controller={controller} />
    </LauncherContext.Provider>
  );
}
