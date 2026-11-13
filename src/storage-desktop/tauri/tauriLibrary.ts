import { guarded } from './tauriFailure';
import type { TauriInvoke } from './tauriInvoke';

/** What the native folder dialog (opened by Rust) came back with. A refusal carries the reason in plain words (storage-backends R11). */
export type FolderChoice = { result: 'chosen'; path: string } | { result: 'cancelled' } | { result: 'refused'; message: string };

/** The `library_*` commands. The page never passes a path: Rust opens the dialog and decides what the folder becomes (R12). */
export interface LibraryClient {
  /** Opens the remembered library; null when none was remembered (first start). */
  open(): Promise<string | null>;
  choose(): Promise<FolderChoice>;
  useDefault(): Promise<string>;
  showInFolder(): Promise<void>;
}

export function createLibraryClient(invoke: TauriInvoke): LibraryClient {
  return {
    open: () => guarded(async () => (await invoke('library_open')) as string | null),
    choose: () => guarded(async () => (await invoke('library_choose')) as FolderChoice),
    useDefault: () => guarded(async () => (await invoke('library_use_default')) as string),
    showInFolder: () => guarded(async () => void (await invoke('library_show_in_folder'))),
  };
}
