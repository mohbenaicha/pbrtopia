// What the rest of the material app may use from the compositing folder (the splat painter).
export { BRUSH_ATLAS_ERROR, type BrushAtlas } from './atlas/readBrushAtlas';
export { loadBrushAtlas } from './atlas/loadBrushAtlas';
export { DEFAULT_BRUSH, type BrushParams } from './plan/brushParams';
export { EMPTY_PALETTE, paintMaterialOf, removeMaterial, removeShape, setMaterial, setShape, shapeSlotsOf, toggleActive, toggleInvert, type Palette, type ShapeSlotNumber } from './session/palette';
export { paintEntryReason } from './session/paintEntryReason';
export { loadPaintMaps, paintedPicturesOf, planCommitPaint, type LoadedPaintMaps } from './session/commitPaint';
export { createPaintController, type PaintController, type PaintState } from './ui/createPaintController';
export { PaintToolPanel } from './ui/PaintToolPanel';
export { LEFT_PANEL_FLOOR } from './ui/paintLayout';
export { ShapePicker } from './ui/ShapePicker';
export { MaterialPicker } from './ui/MaterialPicker';
