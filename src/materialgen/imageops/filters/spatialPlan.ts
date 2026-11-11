import { controlsFor, type EditMapKind, type EditValues } from './editControls';

// Imageops R20, R22: the spatial passes a set of control values asks for, in the order they must run.

export type SpatialMode = 'blur' | 'denoise' | 'sharpness' | 'highpass' | 'clarity' | 'edge' | 'scale';

export interface SpatialPass {
  mode: SpatialMode;
  amount: number;
  bands?: [number, number, number]; // contrast by scale: large, medium and fine
}

const ORDER: readonly { mode: SpatialMode; control: string }[] = [
  { mode: 'blur', control: 'blur' },
  { mode: 'denoise', control: 'denoise' },
  { mode: 'sharpness', control: 'sharpness' },
  { mode: 'highpass', control: 'highpass' },
  { mode: 'clarity', control: 'clarity' },
  { mode: 'edge', control: 'edgeEmphasis' },
];

export function planSpatialPasses(kind: EditMapKind, values: EditValues): SpatialPass[] {
  const shown = new Map(controlsFor(kind).map((control) => [control.id, control]));
  const valueOf = (id: string): number => values[id] ?? shown.get(id)!.defaultValue;
  const plan: SpatialPass[] = [];
  for (const { mode, control } of ORDER) {
    const spec = shown.get(control);
    if (spec && valueOf(control) !== spec.defaultValue) plan.push({ mode, amount: valueOf(control) });
  }
  if (shown.has('contrastLow') && ['contrastLow', 'contrastMid', 'contrastHigh'].some((id) => valueOf(id) !== 1)) {
    plan.push({ mode: 'scale', amount: 0, bands: [valueOf('contrastLow'), valueOf('contrastMid'), valueOf('contrastHigh')] });
  }
  return plan;
}
