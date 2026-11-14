import type { PaintSettings } from '../gpu/createStampPainter';
import type { PaintMaterial } from '../gpu/paintMaterial';
import type { BrushParams } from '../plan/brushParams';

/** Compositing R17-R19: what a stroke writes, from the brush switches and the base material. Height `replace` is 0.5 + level / 2, `add` is level / 2 (R18). */
export function paintSettingsOf(params: BrushParams, material: PaintMaterial): PaintSettings {
  const { height, edgeBurn } = params;
  return {
    material,
    height: !height.on ? null : height.additive ? { mode: 'add', value: height.level / 2 } : { mode: 'replace', value: 0.5 + height.level / 2 },
    edgeBurn: edgeBurn.on ? { direction: edgeBurn.direction } : null,
  };
}
