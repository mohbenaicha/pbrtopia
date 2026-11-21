import { decodeFloat16Vectors } from './float16';

type DataFiles = Record<string, () => Promise<unknown>>;

/** Masks R75: the shipped vectors file, as the address the build gave it. A glob, so a build without the file still works and the matching uses keywords. */
const SHIPPED: DataFiles = import.meta.glob('../data/material-vectors.bin', { query: '?url', import: 'default' });

const fetchBytes = async (url: string): Promise<ArrayBuffer> => {
  const response = await fetch(url);
  if (!response.ok) throw new Error('The material vectors could not be read.');
  return response.arrayBuffer();
};

/** Masks R75: one vector of `dim` numbers per material (`count`), read from the one data file; fails when it is missing or not that long. */
export async function loadMaterialVectorsFrom(files: DataFiles, count: number, dim: number, read: (url: string) => Promise<ArrayBuffer> = fetchBytes): Promise<Float32Array[]> {
  const load = Object.values(files)[0];
  if (load === undefined) throw new Error('The material vectors file is not part of this build.');
  return decodeFloat16Vectors(new Uint8Array(await read((await load()) as string)), count, dim);
}

export const MATERIAL_VECTOR_SIZE = 384;

export const loadMaterialVectors = (count: number): Promise<Float32Array[]> => loadMaterialVectorsFrom(SHIPPED, count, MATERIAL_VECTOR_SIZE);
