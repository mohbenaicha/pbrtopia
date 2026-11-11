import { describe, expect, it } from 'vitest';
import { STRICT_FLAGS, compareStrictFlags } from '../../../scripts/split/compareStrictFlags';

const config = (compilerOptions: Record<string, unknown>) => ({ compilerOptions });
const allOn = { strict: true, exactOptionalPropertyTypes: true, noUncheckedIndexedAccess: true, isolatedModules: true };

describe('materialgen/app R48 compareStrictFlags', () => {
  it('R48 checks exactly strict, exactOptionalPropertyTypes, noUncheckedIndexedAccess and isolatedModules', () => {
    expect([...STRICT_FLAGS].sort()).toEqual(['exactOptionalPropertyTypes', 'isolatedModules', 'noUncheckedIndexedAccess', 'strict']);
  });

  it('R48 finds no difference between two configs with the same flags, whatever else they hold', () => {
    expect(compareStrictFlags(config(allOn), config({ ...allOn, target: 'ES2022' }))).toEqual([]);
  });

  it('R48 names each flag whose value differs, with both values', () => {
    const other = config({ ...allOn, strict: false, isolatedModules: undefined });
    expect(compareStrictFlags(config(allOn), other)).toEqual(['isolatedModules: true vs unset', 'strict: true vs false']);
  });

  it('R48 treats a flag missing on both sides as equal and a missing compilerOptions as all flags unset', () => {
    expect(compareStrictFlags({}, config({}))).toEqual([]);
    expect(compareStrictFlags({}, config(allOn))).toHaveLength(4);
  });
});
