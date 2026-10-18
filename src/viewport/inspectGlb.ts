import type { ViewportErrorCode } from './viewportError';

const GLB_MAGIC = 0x46546c67;
const JSON_CHUNK = 0x4e4f534a;
// The viewer ships no Draco, Meshopt or KTX2 decoder (architecture.md decision 7), so a file that needs one is refused with a clear message.
const UNSUPPORTED_EXTENSIONS = ['KHR_draco_mesh_compression', 'EXT_meshopt_compression', 'KHR_texture_basisu'];

export type GlbInspection = { ok: true } | { ok: false; code: ViewportErrorCode; message: string };

function refuse(code: ViewportErrorCode, message: string): GlbInspection {
  return { ok: false, code, message };
}

// Reads only the GLB header and its JSON chunk, so a wrong or compressed file is named before the loader runs.
export function inspectGlb(glb: ArrayBuffer): GlbInspection {
  const view = new DataView(glb);
  if (glb.byteLength < 20 || view.getUint32(0, true) !== GLB_MAGIC) return refuse('not-glb', 'This is not a GLB file. Export the model as a single .glb.');
  if (view.getUint32(16, true) !== JSON_CHUNK || 20 + view.getUint32(12, true) > glb.byteLength) return refuse('parse-failed', 'This GLB file is damaged.');
  let declared: { extensionsUsed?: unknown; extensionsRequired?: unknown };
  try {
    declared = JSON.parse(new TextDecoder().decode(new Uint8Array(glb, 20, view.getUint32(12, true)))) as typeof declared;
  } catch {
    return refuse('parse-failed', 'This GLB file is damaged.');
  }
  const named = [declared.extensionsUsed, declared.extensionsRequired].flatMap((list) => (Array.isArray(list) ? list : []));
  const unsupported = UNSUPPORTED_EXTENSIONS.find((extension) => named.includes(extension));
  if (unsupported !== undefined) return refuse('unsupported-compression', `This model uses ${unsupported}, which is not supported. Export it without compression.`);
  return { ok: true };
}
