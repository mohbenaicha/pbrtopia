import { useEffect, useMemo, useRef, useState } from 'react';
import { listMaterialOptions, type BaseMaterial, type BaseMaterialTable } from '@mat/masks';
import { createMaterialBallRenderer, type MaterialBallRenderer } from './createMaterialBallRenderer';
import { PickerOverlay } from './PickerOverlay';

export const MATERIAL_LIST_ERROR = 'The material list could not be loaded.'; // R7
export const NO_MATERIAL_MATCH = 'No material matches'; // R7

interface MaterialPickerProps {
  loadTable: () => Promise<BaseMaterialTable>;
  onChoose: (material: BaseMaterial) => void;
  onClose: () => void;
}

const twoDecimals = (value: number): string => value.toFixed(2);

/** One lit ball: asks the shared renderer for its picture once it scrolls into view, so a thousand balls never draw at once (A10). */
function BallTile({ material, renderer, onChoose }: { material: BaseMaterial; renderer: MaterialBallRenderer | null; onChoose: () => void }): React.JSX.Element {
  const button = useRef<HTMLButtonElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const element = button.current;
    if (element === null) return undefined;
    if (typeof IntersectionObserver === 'undefined') {
      setVisible(true);
      return undefined;
    }
    const observer = new IntersectionObserver((entries) => setVisible(entries.some((entry) => entry.isIntersecting)), { rootMargin: '120px' });
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    if (!visible || renderer === null) return undefined;
    return renderer.request(material.name, { rgb: material.rgb, roughness: material.roughness, metal: material.metal }, (picture) => {
      const context = canvas.current?.getContext('2d');
      if (context === null || context === undefined || canvas.current === null) return;
      context.clearRect(0, 0, canvas.current.width, canvas.current.height);
      context.drawImage(picture, 0, 0, canvas.current.width, canvas.current.height);
    });
  }, [visible, renderer, material]);
  return (
    <button ref={button} type="button" className="material-picker__tile" onClick={onChoose}>
      <canvas ref={canvas} className="material-picker__ball" width={96} height={96} aria-hidden="true" />
      <span className="material-picker__name">{material.name}</span>
      <span className="material-picker__values">{twoDecimals(material.roughness)} / {twoDecimals(material.metal)}</span>
    </button>
  );
}

/** Compositing R7: the material table as a searchable grid of lit balls with the name and `rough / metal` under each; the choice closes the overlay. */
export function MaterialPicker({ loadTable, onChoose, onClose }: MaterialPickerProps): React.JSX.Element {
  const [table, setTable] = useState<BaseMaterialTable | null>(null);
  const [failed, setFailed] = useState(false);
  const [search, setSearch] = useState('');
  const [renderer, setRenderer] = useState<MaterialBallRenderer | null>(null);
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
  useEffect(() => {
    let made: MaterialBallRenderer | null = null;
    try {
      made = createMaterialBallRenderer();
    } catch {
      made = null; // no third context: the tiles show their names and numbers without a ball
    }
    setRenderer(made);
    return () => made?.dispose();
  }, []);
  const options = useMemo(() => (table === null ? [] : listMaterialOptions(table, [], search)), [table, search]);
  return (
    <PickerOverlay title="Choose a material" onClose={onClose} search={{ value: search, onChange: setSearch, label: 'Search materials' }}>
      <div className="material-picker">
        {failed && <p className="picker-overlay__message" role="alert">{MATERIAL_LIST_ERROR}</p>}
        {table !== null && options.length === 0 && <p className="picker-overlay__message">{NO_MATERIAL_MATCH}</p>}
        <div className="material-picker__grid">
          {options.map((option) => (
            <BallTile key={option.name} material={option} renderer={renderer} onChoose={() => onChoose(option)} />
          ))}
        </div>
      </div>
    </PickerOverlay>
  );
}
