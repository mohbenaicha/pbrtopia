import { useEffect, useMemo, useState } from 'react';
import { listMaterialOptions, type BaseMaterial, type BaseMaterialTable } from '@mat/masks';
import { MaterialBall } from './MaterialBall';
import { PickerOverlay } from './PickerOverlay';

export const MATERIAL_LIST_ERROR = 'The material list could not be loaded.'; // R7
export const NO_MATERIAL_MATCH = 'No material matches'; // R7

const BALL_PIXELS = 80;

interface MaterialPickerProps {
  loadTable: () => Promise<BaseMaterialTable>;
  onChoose: (material: BaseMaterial) => void;
  onClose: () => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);

/**
 * Compositing R7, R54: the material table as a searchable grid of lit balls with the name and `rough / metal` under each; the choice closes the overlay. The balls
 * are cells of the baked sheet, so opening the picker draws nothing and holds no graphics context.
 */
export function MaterialPicker({ loadTable, onChoose, onClose }: MaterialPickerProps): React.JSX.Element {
  const [table, setTable] = useState<BaseMaterialTable | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  useEffect(() => {
    let cancelled = false;
    loadTable().then(
      (loaded) => !cancelled && setTable(loaded),
      () => !cancelled && setFailed(true),
    );
    return () => {
      cancelled = true;
    };
  }, [loadTable]);
  const options = useMemo(() => (table === null ? [] : listMaterialOptions(table, [], search)), [table, search]);
  return (
    <PickerOverlay title="Choose a material" onClose={onClose} search={{ value: search, onChange: setSearch, label: 'Search materials' }}>
      <div className="material-picker">
        {failed && <p className="picker-overlay__message" role="alert">{MATERIAL_LIST_ERROR}</p>}
        {table !== null && options.length === 0 && <p className="picker-overlay__message">{NO_MATERIAL_MATCH}</p>}
        <div className="material-picker__grid">
          {options.map((option) => (
            <button key={option.name} type="button" className="material-picker__tile" onClick={() => onChoose(option)}>
              <MaterialBall material={option} size={BALL_PIXELS} />
              <span className="material-picker__name">{option.name}</span>
              <span className="material-picker__values">{twoDecimals(option.roughness)} / {twoDecimals(option.metal)}</span>
            </button>
          ))}
        </div>
      </div>
    </PickerOverlay>
  );
}
