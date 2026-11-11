// Materialgen app R48: the strict compiler flags of the two tsconfig files must agree.
export const STRICT_FLAGS = ['strict', 'exactOptionalPropertyTypes', 'noUncheckedIndexedAccess', 'isolatedModules'] as const;

export interface TsconfigFlags {
  compilerOptions?: Record<string, unknown> | undefined;
}

const show = (value: unknown): string => (value === undefined ? 'unset' : String(value));

/** One line per strict flag whose value differs between the two configs, sorted by flag name; empty when they agree. */
export function compareStrictFlags(own: TsconfigFlags, upstream: TsconfigFlags): string[] {
  return [...STRICT_FLAGS]
    .sort()
    .filter((flag) => own.compilerOptions?.[flag] !== upstream.compilerOptions?.[flag])
    .map((flag) => `${flag}: ${show(own.compilerOptions?.[flag])} vs ${show(upstream.compilerOptions?.[flag])}`);
}
