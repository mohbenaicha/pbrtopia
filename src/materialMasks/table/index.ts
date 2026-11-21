// The shipped base-material table and its match vectors, read through Vite's glob. Kept apart from `../index.ts` so code that runs in a worker does not pull the data globs in.
export { loadBaseMaterials, loadBaseMaterialsFrom } from './loadBaseMaterials';
export { MATERIAL_VECTOR_SIZE, loadMaterialVectors, loadMaterialVectorsFrom } from './loadMaterialVectors';
