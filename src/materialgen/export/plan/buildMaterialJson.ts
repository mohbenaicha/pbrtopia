import type { ExportTarget } from '../names/exportNames';
import type { ExportKind } from '../names/exportNames';
import type { ExportOptions, ExportPlan } from './planExport';

export type NormalConvention = 'opengl' | 'directx';

/** Export R12, R13: Blender and the generic export keep the stored OpenGL normal; Maya and Substance Painter are written flipped (DirectX). */
export function normalConventionFor(target: ExportTarget): NormalConvention {
  return target === 'maya' || target === 'substance' ? 'directx' : 'opengl';
}

interface MaterialJsonInput {
  plan: ExportPlan;
  options: ExportOptions;
  projectName: string;
  colorMode: 'albedo' | 'diffuse';
  /** The project's preview settings (preview R34-R36): tiling and the height scale and level. */
  preview: { tilingX: number; tilingY: number; heightScale: number; heightLevel: number };
  app: { name: string; version: string };
  now: () => string; // an injectable clock, ISO 8601 UTC
}

export interface MaterialJson {
  schema: 1;
  target: ExportTarget;
  projectName: string;
  name: string;
  appName: string;
  appVersion: string;
  exportedAt: string;
  size: number;
  colorMode: 'albedo' | 'diffuse';
  normalConvention: NormalConvention;
  packing: 'separate' | 'packed';
  heightScale: number;
  heightMidlevel: number;
  tiling: { x: number; y: number };
  /** R47: the repeats already written into every picture (then `tiling` is 1 x 1); absent when nothing is baked. */
  bakedTiling?: { x: number; y: number };
  colorSpaces: Partial<Record<ExportKind, 'sRGB' | 'Non-Color'>>;
  files: Partial<Record<ExportKind, string>>;
  missing: ExportKind[];
  stale: ExportKind[];
  labels?: string;
  masks?: string;
}

/** Export R10, R13, R23: the sidecar `material.json` content for a plan. The project name appears only here, never in a script. */
export function buildMaterialJson({ plan, options, projectName, colorMode, preview, app, now }: MaterialJsonInput): MaterialJson {
  const files: MaterialJson['files'] = {};
  const colorSpaces: MaterialJson['colorSpaces'] = {};
  for (const file of plan.files) {
    if (file.kind === 'labels' || file.kind === 'masks') continue;
    files[file.kind] = file.fileName;
    colorSpaces[file.kind] = file.kind === 'albedo' ? 'sRGB' : 'Non-Color';
  }
  const labels = plan.files.find((file) => file.kind === 'labels');
  const masks = plan.files.find((file) => file.kind === 'masks');
  return {
    schema: 1,
    target: options.target,
    projectName,
    name: plan.name,
    appName: app.name,
    appVersion: app.version,
    exportedAt: now(),
    size: options.size,
    colorMode,
    normalConvention: normalConventionFor(options.target),
    packing: options.packing,
    heightScale: preview.heightScale,
    heightMidlevel: preview.heightLevel,
    tiling: options.tiling === undefined ? { x: preview.tilingX, y: preview.tilingY } : { x: 1, y: 1 }, // R47: baked repeats are not applied twice
    ...(options.tiling === undefined ? {} : { bakedTiling: { x: options.tiling.x, y: options.tiling.y } }),
    colorSpaces,
    files,
    missing: [...plan.missing],
    stale: [...plan.stale],
    ...(labels === undefined ? {} : { labels: labels.fileName }),
    ...(masks === undefined ? {} : { masks: masks.fileName }),
  };
}
