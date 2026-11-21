import { Slider } from '../../ui-kit';
import { DETAIL_LEVELS, type NormalDetail } from '../normal/detailLevels';

interface DetailSliderProps {
  value: NormalDetail;
  onChange: (value: NormalDetail) => void;
}

const DEFAULT_DETAIL: NormalDetail = 2;
const nameOf = (value: number): string => DETAIL_LEVELS.find((level) => level.level === value)?.name ?? '';

// normal-map R5: how much fine relief the normal map asks for, in four named steps. It changes nothing but the text sent to the image model.
export function DetailSlider({ value, onChange }: DetailSliderProps): React.JSX.Element {
  return (
    <Slider
      label="Detail"
      hint="How much fine relief the image model is asked to put in the normal map: from large shapes only up to every visible variation."
      value={value}
      min={1}
      max={4}
      step={1}
      format={nameOf}
      resetTo={DEFAULT_DETAIL}
      onChange={(next) => onChange(next as NormalDetail)}
    />
  );
}
