import type { TourStage, TourStep } from '@shared/tutorial';
import { listHash, projectHash, settingsHash, SETTINGS_SECTIONS, type SettingsSection } from '../app/routes/router';

export interface MaterialTourStageDeps {
  findSampleId: () => Promise<string | null>; // the bundled sample every project step runs in (tutorial R4)
  currentHash: () => string;
  goTo: (hash: string) => void;
  forgetOpenProject: () => Promise<unknown>; // the tour must not leave its sample as the project to reopen at the next start
  hasNeed?: (need: string) => boolean; // whether the host has what a step needs (tutorial R23)
  openReveal: (id: string) => boolean;
  closeReveal: (id: string) => void;
  pollMs?: number;
  revealTimeoutMs?: number;
}

const wait = (ms: number): Promise<void> => new Promise((resolve) => setTimeout(resolve, ms));

/** Polls `attempt` until it reports success, the time runs out or the move is aborted. */
async function retryUntil(attempt: () => boolean, { pollMs, timeoutMs }: { pollMs: number; timeoutMs: number }, signal?: AbortSignal): Promise<boolean> {
  for (let waited = 0; waited <= timeoutMs; waited += pollMs) {
    if (signal?.aborted === true) return false;
    if (attempt()) return true;
    await wait(pollMs);
  }
  return false;
}

/**
 * The material app's stage for the tour (tutorial R4): hash routes for the sample project, the project list and Settings, and the popovers and the Export dialog
 * through the reveal registry. It remembers where the tour started and goes back there at the end. Nothing here throws: a sample that is gone or a reveal nobody owns
 * leaves the step without its view (the tour then shows a centred card, R8).
 */
export function createMaterialTourStage(deps: MaterialTourStageDeps): TourStage {
  const pollMs = deps.pollMs ?? 50;
  const revealTimeoutMs = deps.revealTimeoutMs ?? 2000;
  let origin: string | null = null;
  let opened = new Set<string>();

  const hashFor = async (stage: string): Promise<string | null> => {
    if (stage === 'list') return listHash();
    if (stage.startsWith('settings:')) {
      const section = stage.slice('settings:'.length);
      return SETTINGS_SECTIONS.includes(section as SettingsSection) ? settingsHash(section as SettingsSection) : null;
    }
    const id = await deps.findSampleId();
    return id === null ? null : projectHash(id);
  };

  const closeAll = (): void => {
    opened.forEach((id) => deps.closeReveal(id));
    opened = new Set();
  };

  return {
    async enter(step: TourStep, signal: AbortSignal): Promise<void> {
      if (origin === null) origin = deps.currentHash();
      const hash = await hashFor(step.stage ?? 'project');
      if (signal.aborted) return;
      if (hash !== null && hash !== deps.currentHash()) {
        closeAll(); // their owners are about to unmount
        deps.goTo(hash);
      }
      const wanted = new Set(step.reveal ?? []);
      opened.forEach((id) => {
        if (!wanted.has(id)) {
          deps.closeReveal(id);
          opened.delete(id);
        }
      });
      for (const id of wanted) {
        if (opened.has(id)) continue;
        if (await retryUntil(() => deps.openReveal(id), { pollMs, timeoutMs: revealTimeoutMs }, signal)) opened.add(id);
      }
    },

    has: (need: string): boolean => deps.hasNeed?.(need) ?? true,

    async leave(): Promise<void> {
      closeAll();
      if (origin === null) return;
      const back = origin === '' || origin === '#' || origin === '#/' ? listHash() : origin;
      origin = null;
      if (back !== deps.currentHash()) deps.goTo(back);
      if (back === listHash()) await deps.forgetOpenProject();
    },
  };
}
