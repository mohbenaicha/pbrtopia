// What stays in material gen of the mask code (material-masks-core R2). The rest is in `@shared/materialMasks`.
export { buildCoverage, sampleLabels, type CoverageInput } from './bake/coverage';
export { paintCoverageOverlay, paintLabelOverlay } from './palette/labelOverlay';
export { HEIGHT_SENSITIVITY, bakeHeight, type HeightBakeInput } from './bake/bakeHeight';
export { runHeightJob, startHeightJob, type HeightJobInput, type StartHeightJobOptions } from './worker/heightJob';
export { ModelMasksPanel, type ModelMasksPanelProps } from './ui/ModelMasksPanel';
export type { MasksModelControls } from './ui/ModelRunParts';
