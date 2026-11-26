import { IMAGE_CLOSING, IMAGE_OPENING, describeReferences } from '../prompts/framePrompt';
import type { MapRecipe } from '../prompts/mapRecipes';
import { describeViewMarks } from '../prompts/viewMarksWording';
import { CORE_CAMERA_NAMES } from './planTypes';

// Custom generation R14, R27: the wording that is specific to a sheet.

export interface TilePlacement {
  camera: number; // core index
  centerX: number; // tile centre as a fraction of the canvas, 0 left to 1 right
  centerY: number; // 0 top to 1 bottom
}

const cameraName = (camera: number) => CORE_CAMERA_NAMES[camera] ?? `camera ${camera}`;
const sortedNames = (cameras: number[]) => [...cameras].sort((a, b) => a - b).map(cameraName);

// The caption of a sheet in the Debug tab: its camera names in core order.
export function describeSheetCaption(cameras: number[], kind: 'core' | 'aux' = 'core'): string {
  return kind === 'aux' ? 'Auxiliary' : sortedNames(cameras).join(', ');
}

// Where a tile centre lies on the canvas, in thirds: "left", "top-right", "centre".
export function describeTilePlace(centerX: number, centerY: number): string {
  const horizontal = centerX < 1 / 3 ? 'left' : centerX > 2 / 3 ? 'right' : '';
  const vertical = centerY < 1 / 3 ? 'top' : centerY > 2 / 3 ? 'bottom' : '';
  return [vertical, horizontal].filter((part) => part !== '').join('-') || 'centre';
}

function joinNames(names: string[]): string {
  if (names.length <= 1) return names.join('');
  return `${names.slice(0, -1).join(', ')} and ${names[names.length - 1]}`;
}

function describeTiles(tiles: TilePlacement[]): string {
  if (tiles.length === 0) return '';
  if (tiles.length === 1) return `The image holds one tile: the ${cameraName(tiles[0]!.camera)} view.`;
  const each = tiles.map((tile) => `${describeTilePlace(tile.centerX, tile.centerY)} tile: the ${cameraName(tile.camera)} view`);
  return `The image holds ${tiles.length} tiles (${each.join('; ')}).`;
}

function describeLeadReference(leadCameras: number[]): string {
  const names = sortedNames(leadCameras);
  const views = names.length === 1 ? `the ${names[0]} view` : `the ${joinNames(names)} views`;
  return `Image 2 is the already textured image of the same object; it shows ${views}. Use it as the guide for the colours, materials and style of the views in image 1. Do not texture it, and do not paste its layout into the result.`;
}

interface SheetImagePromptParts {
  recipe: MapRecipe;
  description: string; // the enhancer's description, the same for every sheet
  referenceCount: number; // the user's references on the lead sheet; ignored when `leadCameras` is set
  leadCameras: number[] | null; // set on a follow-up sheet: the cameras the lead image shows
  aux: boolean;
  tiles: TilePlacement[];
}

// R14: opening, view marks note (core sheets only, snapshot-orientation R7), references note (the user's, or the lead image's),
// tile note, recipe text before, description, recipe text after, closing; each trimmed, empty ones left out.
export function buildSheetImagePrompt({ recipe, description, referenceCount, leadCameras, aux, tiles }: SheetImagePromptParts): string {
  const referenceNote = leadCameras ? describeLeadReference(leadCameras) : describeReferences(referenceCount);
  const tileNote = aux ? 'The tiles in the image are extra viewpoints of the same object.' : describeTiles(tiles);
  return [IMAGE_OPENING, aux ? '' : describeViewMarks(), referenceNote,tileNote, recipe.textBefore, description, recipe.textAfter, IMAGE_CLOSING]
    .map((part) => part.trim())
    .filter((part) => part !== '')
    .join('\n\n');
}
