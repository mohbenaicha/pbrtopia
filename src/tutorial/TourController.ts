import { waitForAnchor } from './anchors';
import type { StepWords, TourSection, TourSnapshot, TourStage, TourStep } from './tourTypes';

export const ANCHOR_TIMEOUT_MS = 1500;

export interface TourControllerOptions {
  sections: TourSection[];
  stage: TourStage;
  texts: Record<string, StepWords>;
  /** Finds a step's target; the page's `data-tutorial` lookup by default. Tests pass their own. */
  findAnchor?: (anchor: string, signal: AbortSignal) => Promise<Element | null>;
}

const IDLE: TourSnapshot = { active: false, index: 0, total: 0, step: null, sectionTitle: '', heading: '', paragraphs: [], phase: 'moving', target: null };

/**
 * The tour's state and its moves between steps (tutorial R3, R4, R8). A move asks the stage to take the app to the step, then waits for the step's target; a newer
 * move aborts the older one, so only the last step shows. A stage that fails or a target that is missing shows the step without a spotlight and the tour goes on.
 */
export class TourController {
  private readonly steps: Array<{ step: TourStep; sectionTitle: string; sectionId: string }>;
  private readonly listeners = new Set<() => void>();
  private snap: TourSnapshot = IDLE;
  private move: AbortController | null = null;

  constructor(private readonly options: TourControllerOptions) {
    this.steps = options.sections.flatMap((section) => section.steps.map((step) => ({ step, sectionTitle: section.title, sectionId: section.id })));
  }

  snapshot = (): TourSnapshot => this.snap;

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => void this.listeners.delete(listener);
  };

  /** Starts at the first step, or at the first step of a section (tutorial R11). Starting while it runs restarts it (R1). */
  start(options: { sectionId?: string } = {}): void {
    const first = options.sectionId === undefined ? 0 : this.steps.findIndex((entry) => entry.sectionId === options.sectionId);
    if (first === -1 || this.steps.length === 0) return;
    void this.goTo(first);
  }

  next(): void {
    if (!this.snap.active) return;
    if (this.snap.index >= this.steps.length - 1) this.exit();
    else void this.goTo(this.snap.index + 1);
  }

  previous(): void {
    if (this.snap.active && this.snap.index > 0) void this.goTo(this.snap.index - 1);
  }

  /** Ends the tour (Exit, Esc, or Next on the last step); the stage puts the app back once. */
  exit(): void {
    if (!this.snap.active) return;
    this.move?.abort();
    this.move = null;
    this.set(IDLE);
    void this.options.stage.leave().catch(() => undefined);
  }

  private async goTo(index: number): Promise<void> {
    this.move?.abort();
    const move = new AbortController();
    this.move = move;
    const entry = this.steps[index];
    if (entry === undefined) return;
    const words = this.options.texts[entry.step.id] ?? { heading: entry.step.id, paragraphs: [] };
    this.set({ active: true, index, total: this.steps.length, step: entry.step, sectionTitle: entry.sectionTitle, heading: words.heading, paragraphs: words.paragraphs, phase: 'moving', target: null });

    let target: Element | null = null;
    try {
      await this.options.stage.enter(entry.step, move.signal);
      if (move.signal.aborted) return;
      target = await (this.options.findAnchor ?? ((anchor, signal) => waitForAnchor(anchor, ANCHOR_TIMEOUT_MS, signal)))(entry.step.anchor, move.signal);
    } catch {
      target = null; // tutorial R8: a failing stage shows the step without a spotlight
    }
    if (move.signal.aborted) return;
    this.set({ ...this.snap, phase: 'showing', target });
  }

  private set(next: TourSnapshot): void {
    this.snap = next;
    this.listeners.forEach((listener) => listener());
  }
}
