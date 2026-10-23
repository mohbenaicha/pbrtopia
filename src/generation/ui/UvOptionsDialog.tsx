import { useState } from 'react';
import { Button, Dialog, Select, TextInput } from '../../ui-kit';

// The unwrap options the user picks (engine R46). The engine's UnwrapOptions has the same two fields; generation does not import the engine.
export interface UvOptions {
  resolution: 1024 | 2048 | 4096;
  paddingTexels: number;
}

interface UvOptionsDialogProps {
  open: boolean;
  onCancel: () => void;
  onConfirm: (options: UvOptions) => void;
}

const SIZES: { value: string; label: string }[] = [
  { value: '1024', label: '1K (1024 px)' },
  { value: '2048', label: '2K (2048 px)' },
  { value: '4096', label: '4K (4096 px)' },
];
const MAX_PADDING = 64;
const PADDING_ERROR = `Enter a whole number from 0 to ${MAX_PADDING}.`;

const parsePadding = (text: string): number | null => {
  if (!/^\d+$/.test(text)) return null;
  const value = Number(text);
  return value <= MAX_PADDING ? value : null;
};

function UvOptionsForm({ onCancel, onConfirm }: Omit<UvOptionsDialogProps, 'open'>): React.JSX.Element {
  const [resolution, setResolution] = useState('2048');
  const [padding, setPadding] = useState('3');
  const parsed = parsePadding(padding);
  return (
    <Dialog
      open
      title="Generate UV"
      onClose={onCancel}
      actions={
        <>
          <Button onClick={onCancel}>Cancel</Button>
          <Button variant="primary" disabled={parsed === null} onClick={() => parsed !== null && onConfirm({ resolution: Number(resolution) as UvOptions['resolution'], paddingTexels: parsed })}>Generate UV</Button>
        </>
      }
    >
      <Select label="Atlas resolution" options={SIZES} value={resolution} onChange={setResolution} />
      <TextInput label="Padding (texels)" value={padding} onChange={setPadding} {...(parsed === null ? { error: PADDING_ERROR } : {})} />
    </Dialog>
  );
}

// R15: the options asked before the unwrap runs. The form is mounted only while open, so every opening starts from the defaults (2K, 3 texels).
export function UvOptionsDialog({ open, onCancel, onConfirm }: UvOptionsDialogProps): React.JSX.Element | null {
  return open ? <UvOptionsForm onCancel={onCancel} onConfirm={onConfirm} /> : null;
}
