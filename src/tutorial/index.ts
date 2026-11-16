// The guided tour engine (specs/materialgen/tutorial): what an app needs to run a tour of its own steps.
export { TourController, ANCHOR_TIMEOUT_MS, type TourControllerOptions } from './TourController';
export { TourLayer } from './TourLayer';
export { closeReveal, openReveal, useRevealOnTour, type RevealHandlers } from './revealRegistry';
export { createTourSeenStorage, type TourSeenStorage } from './tourSeen';
export { parseTutorialText, type StepText } from './tutorialText';
export { renderInlineMarkup } from './inlineMarkup';
export { useTour } from './useTour';
export type { StepWords, TourSection, TourSnapshot, TourStage, TourStep } from './tourTypes';
