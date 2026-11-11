import type { SelectOption } from '@shared/ui-kit';
import { MATERIAL_SIZES, type MaterialSize } from '@mat/storage';

export const AUTO_SIZE_CHOICE = 'auto';

/** Materialgen app R19, R24: the sizes S offers, then "Auto (from first image)". */
export const SIZE_OPTIONS: SelectOption[] = [
  ...MATERIAL_SIZES.map((size) => ({ value: String(size), label: `${size} px` })),
  { value: AUTO_SIZE_CHOICE, label: 'Auto (from first image)' },
];

export const choiceOfSize = (size: MaterialSize | null): string => (size === null ? AUTO_SIZE_CHOICE : String(size));

/** The size a select value stands for; anything unknown means Auto. */
export function sizeOfChoice(choice: string): MaterialSize | null {
  return MATERIAL_SIZES.find((size) => String(size) === choice) ?? null;
}
