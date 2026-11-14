import { useState } from 'react';
import { ConfirmDialog, Select } from '@shared/ui-kit';
import type { MaterialRecord, MaterialSize } from '@mat/storage';
import { SIZE_OPTIONS, choiceOfSize, sizeOfChoice } from '../project/sizeChoices';

interface SizeFieldProps {
  record: MaterialRecord;
  canWrite: boolean;
  /** True while the maps are being resized, so the select cannot be used again. */
  resizing: boolean;
  /** Sets S on a project without maps. */
  onSizeChange(size: MaterialSize | null): void;
  /** Resizes every map to S, after the confirmation (maps R21). */
  onResizeMaps(size: MaterialSize): void;
}

/** Materialgen app R19: the size select, among the Generate panel's selects like the projection app's resolution (no name field, R14; no kind choice, R15). With maps, a new size asks first and Auto does not apply. */
export function SizeField({ record, canWrite, resizing, onSizeChange, onResizeMaps }: SizeFieldProps): React.JSX.Element {
  const [pendingSize, setPendingSize] = useState<MaterialSize | null>(null);
  const hasMaps = Object.keys(record.maps).length > 0;

  const choose = (choice: string): void => {
    const size = sizeOfChoice(choice);
    if (!hasMaps) return onSizeChange(size);
    if (size !== null && size !== record.size) setPendingSize(size); // Auto means nothing once there are maps (app R19)
  };

  return (
    <>
      <Select label="Size" options={SIZE_OPTIONS} value={choiceOfSize(record.size)} onChange={choose} disabled={!canWrite || resizing} title={hasMaps ? 'The side length of every map; choosing another size resizes them all.' : 'The side length, in pixels, of the maps this material will make.'} />
      <ConfirmDialog
        open={pendingSize !== null}
        title={`Change the size to ${pendingSize ?? ''} px?`}
        confirmLabel="Change size"
        busy={false}
        onCancel={() => setPendingSize(null)}
        onConfirm={() => {
          if (pendingSize !== null) onResizeMaps(pendingSize);
          setPendingSize(null);
        }}
      >
        <p>Every map is resized to {pendingSize} x {pendingSize} px. Undo restores the previous size.</p>
      </ConfirmDialog>
    </>
  );
}
