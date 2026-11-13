import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { RawRecord } from '@shared/projects';
import type { StageOverlay } from '@shared/ui-kit';
import type { PixelImage } from '@mat/imageops';
import { readMapPixels } from '@mat/maps';
import { buildCoverage, paintLabelOverlay, parseMasksRecord, sampleLabels, type MaskRow, type PaletteEntry } from '@mat/masks';

interface FilterMaskScopeInput {
  masksRecord: RawRecord | undefined;
  labelsKey: string | null; // the labels map's working copy, or null when the project has none
  size: number; // S: the labels must be this size to be used (imageops R78)
  previewSize: number; // P: the size the preview and the hover overlay are drawn at
  readBlob(key: string): Promise<Blob | null>;
}

export interface FilterMaskScope {
  /** What the swatch grid shows; null when there are no usable masks (no swatch is drawn). */
  swatches: { rows: readonly MaskRow[]; palette: readonly PaletteEntry[] } | null;
  selected: readonly number[];
  toggle(label: number): void;
  highlight(label: number | null): void;
  /** The hover overlay at P, or null. */
  overlay: StageOverlay | null;
  /** The coverage at P for the preview (R79), or null when nothing is selected. */
  previewCoverage: PixelImage | null;
  /** The coverage at S for Apply, built when asked (R81), or null when nothing is selected. */
  finalCoverage(): PixelImage | null;
}

/**
 * Imageops R78-R81: the mask scope of one filter dialog. The labels are read once, when masks exist; a click changes the selection, which builds one coverage at P
 * (tens of milliseconds at most, never during a slider drag); the coverage at S is built only when Apply asks. Only the labels at P and the coverage planes are kept.
 */
export function useFilterMaskScope({ masksRecord, labelsKey, size, previewSize, readBlob }: FilterMaskScopeInput): FilterMaskScope {
  const record = useMemo(() => parseMasksRecord(masksRecord), [masksRecord]);
  const [labels, setLabels] = useState<PixelImage | null>(null);
  const [selected, setSelected] = useState<readonly number[]>([]);
  const [hover, setHover] = useState<number | null>(null);
  const read = useRef(readBlob);
  read.current = readBlob;

  useEffect(() => {
    if (record === null || labelsKey === null) return undefined;
    let cancelled = false;
    void (async () => {
      try {
        const image = await readMapPixels(await read.current(labelsKey));
        if (!cancelled && image !== null && image.width === size && image.height === size && image.channels === 1) setLabels(image);
      } catch {
        // the labels cannot be read: no swatch is drawn and the whole map is edited
      }
    })();
    return () => { cancelled = true; };
  }, [record === null, labelsKey, size]); // read once per dialog

  const feather = record?.feather ?? 0;
  const labelsAtPreview = useMemo(() => (labels === null ? null : sampleLabels(labels, previewSize)), [labels, previewSize]);
  const previewCoverage = useMemo(() => (labels === null ? null : buildCoverage({ labels, selected, feather, side: previewSize })), [labels, selected, feather, previewSize]);
  const overlay = useMemo<StageOverlay | null>(() => {
    const entry = record?.palette.find((candidate) => candidate.label === hover);
    if (labelsAtPreview === null || hover === null || entry === undefined) return null;
    return { width: labelsAtPreview.width, height: labelsAtPreview.height, rgba: paintLabelOverlay(labelsAtPreview, hover, entry.hex) };
  }, [record, labelsAtPreview, hover]);
  const finalCoverage = useCallback(() => (labels === null ? null : buildCoverage({ labels, selected, feather, side: size })), [labels, selected, feather, size]);
  const toggle = useCallback((label: number) => setSelected((current) => (current.includes(label) ? current.filter((other) => other !== label) : [...current, label])), []);

  return {
    swatches: record === null || labels === null ? null : { rows: record.rows, palette: record.palette },
    selected,
    toggle,
    highlight: setHover,
    overlay,
    previewCoverage,
    finalCoverage,
  };
}
