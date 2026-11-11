import { useState } from 'react';
import { Disclosure } from '@shared/ui-kit';
import type { EditControl, EditValues } from '../filters/editControls';
import { ControlRow } from './ControlRow';
import './opControls.css';

interface ControlPanelProps {
  controls: readonly EditControl[];
  categoryLabels: Readonly<Record<string, string>>;
  values: EditValues;
  onChange: (id: string, value: number) => void;
}

/** Imageops R17: the controls in an accordion of the categories the map kind has; one is open at a time and the first is open at the start. */
export function ControlPanel({ controls, categoryLabels, values, onChange }: ControlPanelProps): React.JSX.Element {
  const categories = [...new Set(controls.map((control) => control.category))];
  const [open, setOpen] = useState<string | null>(categories[0] ?? null);
  return (
    <div className="op-controls">
      {categories.map((category) => (
        <Disclosure key={category} title={categoryLabels[category] ?? category} open={open === category} onOpenChange={(next) => setOpen(next ? category : null)}>
          <div className="op-controls__rows">
            {controls.filter((control) => control.category === category).map((control) => (
              <ControlRow key={control.id} control={control} value={values[control.id] ?? control.defaultValue} onChange={(value) => onChange(control.id, value)} />
            ))}
          </div>
        </Disclosure>
      ))}
    </div>
  );
}
