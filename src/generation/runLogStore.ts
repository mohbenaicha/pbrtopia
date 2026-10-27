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
  errorMessage: string | null;
  errorDetails: string | null; // the provider's own text, shown as plain text
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
}

export interface RunLogActions {
  begin: (start: RunLogStart) => string;
  resume: (id: string) => boolean; // false when the row is gone
  setAtlas: (id: string, atlas: Blob) => void;
  setEnhancedPrompt: (id: string, text: string) => void;
  setImage: (id: string, preview: Blob) => void;
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
        const record: RunLogRecord = { id, ...start, outcome: 'running', atlas: null, enhancedPrompt: null, imagePreview: null, errorMessage: null, errorDetails: null };
        set((state) => ({ records: trimToLimit([record, ...state.records]), activeId: id }));
        return id;
      },
      resume: (id) => {
        if (!get().records.some((record) => record.id === id)) return false;
        update(id, { outcome: 'running', errorMessage: null, errorDetails: null, imagePreview: null }); // the retried run feeds the parts it reuses in again
        set({ activeId: id });
        return true;
      },
      setAtlas: (id, atlas) => update(id, { atlas }),
      setEnhancedPrompt: (id, enhancedPrompt) => update(id, { enhancedPrompt }),
      setImage: (id, imagePreview) => update(id, { imagePreview }),
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
