// Hidden-triangle marks stored in a model file, and the geometry helper that drops the hidden triangles.
// Neutral ground: the engine, the viewport and mesh edit all read the same marks, and none may import the others.
export { flagsFromRanges, MESH_EDIT_KEY, readHiddenMarks, writeHiddenMarks, type HiddenRanges } from './hiddenMarks';
export { removeHiddenTriangles } from './removeHiddenTriangles';
