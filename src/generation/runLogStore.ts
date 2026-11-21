import { createStore } from 'zustand';

export type RunOutcome = 'running' | 'done' | 'failed' | 'cancelled';

// R24: one Generate run as the Debug tab shows it. Memory only (R26).
export interface RunLogRecord {
  id: string;
  projectId: string;
  startedAt: number; // ms since the epoch
  modelLabel: string;
  outcome: RunOutcome;
  prompt: string; // as the user typed it
  atlas: Blob | null;
  enhancedPrompt: string | null;
  imagePreview: Blob | null; // at most 1024 px on the long side
  sheets: RunLogSheet[]; // custom R27: a custom run's snapshots and returned images by sheet; empty for a standard run
  errorMessage: string | null;
  errorDetails: string | null; // the provider's own text, shown as plain text
  normal?: NormalRunSettings; // normal-map R12: set on a normal-map run's row; its `atlas` is then the albedo picture sent and `prompt` the text sent
  masks?: MaskRunLog; // mask-generation R13: set on a mask run's row; `prompt` is the user's description of the materials and there is no enhanced prompt
}

// mask-generation R13: what a mask row shows besides the atlas and the image: the sheet the describe model saw and the components it listed.
export interface MaskRunLog {
  sheet: Blob | null; // the labelled sheet, at most the enhancer image size
  components: MaskLogComponent[];
}

export interface MaskLogComponent {
  name: string;
  description: string;
  location: string;
  hex: string; // its palette colour
}

// normal-map R12: what a normal-map row shows besides the model and the pictures.
export interface NormalRunSettings {
  detail: 1 | 2 | 3 | 4;
  quality: string | null;
  made?: Blob | null; // the normal map the run built from the height map, at most 1024 px; the row's `atlas` is the upright sheet sent and `imagePreview` the height map returned
}

// Custom R27: one image of a custom run: what was sent for it and what came back, captioned by its camera names.
export interface RunLogSheet {
  index: number;
  label: string;
  snapshot: Blob | null;
  image: Blob | null;
}

export interface RunLogError {
  message: string;
  details?: string;
}

export interface RunLogStart {
  projectId: string;
  modelLabel: string;
  prompt: string;
  startedAt: number;
  normal?: NormalRunSettings;
  masks?: true; // mask-generation R13: the row of a mask run
}

export interface RunLogActions {
  begin: (start: RunLogStart) => string;
  resume: (id: string, sent?: Pick<RunLogStart, 'modelLabel' | 'prompt' | 'normal'>) => boolean; // false when the row is gone; `sent` replaces what the retried attempt sends (normal-map R11)
  setAtlas: (id: string, atlas: Blob) => void;
  setEnhancedPrompt: (id: string, text: string) => void;
  setImage: (id: string, preview: Blob) => void;
  setNormalMade: (id: string, preview: Blob) => void; // normal-map R12
  setMaskSheet: (id: string, preview: Blob) => void; // mask-generation R13
  setMaskComponents: (id: string, components: MaskLogComponent[]) => void; // mask-generation R13
  setSheetPicture: (id: string, sheet: { index: number; label: string }, kind: 'snapshot' | 'image', preview: Blob) => void;
  finish: (id: string, outcome: Exclude<RunOutcome, 'running'>, error?: RunLogError) => void;
  remove: (id: string) => void;
}

export interface RunLogState extends RunLogActions {
  records: RunLogRecord[]; // newest first
  activeId: string | null; // the latest run, for the step list's link (R27)
}

// R26: rows kept in all.
export const MAX_RUN_LOG_RECORDS = 10;

// R26: over the limit, the oldest row that is not running goes first; a running row is never dropped, nor is `keepId` (the row that just ended).
function trimToLimit(records: RunLogRecord[], keepId?: string): RunLogRecord[] {
  const trimmed = [...records];
  while (trimmed.length > MAX_RUN_LOG_RECORDS) {
    const oldestIdle = trimmed.map((record) => record.outcome !== 'running' && record.id !== keepId).lastIndexOf(true);
    if (oldestIdle < 0) break;
    trimmed.splice(oldestIdle, 1);
  }
  return trimmed;
}

export function createRunLogStore() {
  return createStore<RunLogState>()((set, get) => {
    const update = (id: string, change: Partial<RunLogRecord>): void => {
      if (!get().records.some((record) => record.id === id)) return;
      set((state) => ({ records: state.records.map((record) => (record.id === id ? { ...record, ...change } : record)) }));
    };
    return {
      records: [],
      activeId: null,
      begin: (start) => {
        const id = crypto.randomUUID();
        const { masks, ...rest } = start;
        const record: RunLogRecord = { id, ...rest, outcome: 'running', atlas: null, enhancedPrompt: null, imagePreview: null, sheets: [], errorMessage: null, errorDetails: null, ...(masks === true ? { masks: { sheet: null, components: [] } } : {}) };
        set((state) => ({ records: trimToLimit([record, ...state.records]), activeId: id }));
        return id;
      },
      resume: (id, sent) => {
        if (!get().records.some((record) => record.id === id)) return false;
        const resumed = get().records.find((record) => record.id === id);
        const normal = sent?.normal ?? resumed?.normal;
        update(id, {
          outcome: 'running', errorMessage: null, errorDetails: null, imagePreview: null,
          ...(sent === undefined ? {} : { modelLabel: sent.modelLabel, prompt: sent.prompt }),
          ...(resumed?.masks === undefined ? {} : { masks: { sheet: null, components: [] } }),
          ...(normal === undefined ? {} : { normal: { detail: normal.detail, quality: normal.quality } }),
        }); // the retried run feeds the parts it reuses in again
        set({ activeId: id });
        return true;
      },
      setAtlas: (id, atlas) => update(id, { atlas }),
      setEnhancedPrompt: (id, enhancedPrompt) => update(id, { enhancedPrompt }),
      setImage: (id, imagePreview) => update(id, { imagePreview }),
      setNormalMade: (id, made) => {
        const normal = get().records.find((record) => record.id === id)?.normal;
        if (normal !== undefined) update(id, { normal: { ...normal, made } });
      },
      setMaskSheet: (id, sheet) => {
        const masks = get().records.find((record) => record.id === id)?.masks;
        if (masks !== undefined) update(id, { masks: { ...masks, sheet } });
      },
      setMaskComponents: (id, components) => {
        const masks = get().records.find((record) => record.id === id)?.masks;
        if (masks !== undefined) update(id, { masks: { ...masks, components } });
      },
      setSheetPicture: (id, { index, label }, kind, preview) => {
        const record = get().records.find((candidate) => candidate.id === id);
        if (record === undefined) return;
        const current = record.sheets.find((sheet) => sheet.index === index) ?? { index, label, snapshot: null, image: null };
        const next: RunLogSheet = { ...current, label, [kind]: preview };
        update(id, { sheets: [...record.sheets.filter((sheet) => sheet.index !== index), next].sort((a, b) => a.index - b.index) });
      },
      finish: (id, outcome, error) => {
        if (!get().records.some((record) => record.id === id)) return;
        update(id, { outcome, errorMessage: error?.message ?? null, errorDetails: error?.details ?? null });
        set((state) => ({ records: trimToLimit(state.records, id) })); // rows that ran at once can have left the log over the limit
      },
      remove: (id) => {
        const target = get().records.find((record) => record.id === id);
        if (target === undefined || target.outcome === 'running') return;
        set((state) => ({ records: state.records.filter((record) => record.id !== id) }));
      },
    };
  });
}

export const runLogStore = createRunLogStore();
