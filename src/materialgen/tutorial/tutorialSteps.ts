import type { TourSection, TourStep } from '@shared/tutorial';
import { NEED_ENV_KEYS, REVEAL_EXPORT, REVEAL_MAP_ACTIONS, REVEAL_MASK_DISPLAY, REVEAL_MASK_SELECT, REVEAL_VIEWPORT_SETTINGS } from './revealIds';

const step = (id: string, anchor: string, extra: Partial<Pick<TourStep, 'stage' | 'reveal' | 'needs'>> = {}): TourStep => ({ id, anchor, ...extra });

/** A step without a `stage` runs where the step before it did, so Previous across a view change goes back to the right view. */
function inheritStages(sections: TourSection[]): TourSection[] {
  let stage = 'project';
  return sections.map((section) => ({
    ...section,
    steps: section.steps.map((entry) => {
      stage = entry.stage ?? stage;
      return { ...entry, stage };
    }),
  }));
}

/** The tour in the order of the spec's step table (tutorial R3). Words are in `tutorial-text.md`, keyed by the step ids. */
export const TUTORIAL_SECTIONS: TourSection[] = inheritStages([
  {
    id: 'generate',
    title: 'Generate panel',
    steps: [
      step('generate.prompt', 'generate-prompt', { stage: 'project' }),
      step('generate.ideas', 'generate-ideas'),
      step('generate.references', 'generate-references'),
      step('generate.color', 'generate-color'),
      step('generate.size', 'generate-size'),
      step('generate.model', 'generate-model'),
      step('generate.button', 'generate-button'),
      step('generate.summary', 'generate-summary'),
      step('generate.log', 'generate-log'),
    ],
  },
  {
    id: 'maps',
    title: 'Maps',
    steps: [
      step('maps.tools', 'maps-tools'),
      step('maps.cards', 'maps-grid'),
      step('maps.card-actions', 'maps-card-actions', { reveal: [REVEAL_MAP_ACTIONS] }),
      step('maps.occlusion', 'maps-occlusion', { reveal: [REVEAL_MAP_ACTIONS] }),
    ],
  },
  {
    id: 'viewport',
    title: 'Viewport settings',
    steps: [
      step('viewport.open', 'viewport-gear'),
      step('viewport.environment', 'viewport-environment', { reveal: [REVEAL_VIEWPORT_SETTINGS] }),
      step('viewport.material', 'viewport-material', { reveal: [REVEAL_VIEWPORT_SETTINGS] }),
      step('viewport.preview-only', 'viewport-settings', { reveal: [REVEAL_VIEWPORT_SETTINGS] }),
    ],
  },
  {
    id: 'masks',
    title: 'Material masks',
    steps: [
      step('masks.open', 'masks-button', { reveal: [] }),
      step('masks.swatches', 'masks-swatches', { reveal: [REVEAL_MASK_DISPLAY] }),
      step('masks.properties', 'masks-properties', { reveal: [REVEAL_MASK_DISPLAY, REVEAL_MASK_SELECT] }),
    ],
  },
  { id: 'shading', title: 'Preview shading', steps: [step('shading.control', 'preview-shading', { reveal: [] })] },
  { id: 'topbar', title: 'Top bar', steps: [step('topbar.actions', 'topbar-actions')] },
  {
    id: 'export',
    title: 'Export',
    steps: [
      step('export.types', 'export-types', { reveal: [REVEAL_EXPORT] }),
      step('export.packing', 'export-options', { reveal: [REVEAL_EXPORT] }),
      step('export.parts', 'export-parts', { reveal: [REVEAL_EXPORT] }),
      step('export.size', 'export-size', { reveal: [REVEAL_EXPORT] }),
    ],
  },
  {
    id: 'projects',
    title: 'Projects view',
    steps: [
      step('projects.new', 'projects-new', { stage: 'list', reveal: [] }),
      step('projects.import', 'projects-import'),
      step('projects.settings', 'projects-settings'),
      step('projects.card', 'projects-card-actions'),
    ],
  },
  {
    id: 'settings',
    title: 'Settings',
    steps: [step('settings.keys', 'settings-keys', { stage: 'settings:keys' }), step('settings.env', 'settings-env', { needs: NEED_ENV_KEYS }), step('settings.models', 'settings-models', { stage: 'settings:models' }), step('settings.storage', 'settings-storage', { stage: 'settings:storage' })],
  },
]);
