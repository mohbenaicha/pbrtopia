/** One stop of the tour (tutorial R3, R10). `stage` and `reveal` are names the app's stage understands; the engine only passes them on. */
export interface TourStep {
  id: string;
  anchor: string; // the `data-tutorial` id of the element to circle
  stage?: string; // the view the step needs: 'project', 'list', 'settings:keys'...
  reveal?: string[]; // what must be open while the step shows: 'viewport-settings', 'export'...
}

export interface TourSection {
  id: string;
  title: string;
  steps: TourStep[];
}

/** What the app does for the tour: goes where a step needs it and puts everything back afterwards (tutorial R4). */
export interface TourStage {
  /** Goes to the step's view and opens its reveals, closing the ones it no longer needs. Resolves when the app is ready for the step. */
  enter(step: TourStep, signal: AbortSignal): Promise<void>;
  /** Closes everything the tour opened and returns to the view the tour started from. */
  leave(): Promise<void>;
}

export interface StepWords {
  heading: string;
  paragraphs: string[];
}

export interface TourSnapshot {
  active: boolean;
  index: number; // 0-based over the whole tour
  total: number;
  step: TourStep | null;
  sectionTitle: string;
  heading: string;
  paragraphs: string[];
  phase: 'moving' | 'showing';
  target: Element | null; // null while moving, or when the anchor was not found (tutorial R8)
}
