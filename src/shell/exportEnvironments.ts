import type { DesktopPickers } from './backends/appBackends';
import { saveBlobAsFile } from './saveBlobAsFile';
import type { DownloadEnvironment } from './saveZipFile';
import type { FolderEnvironment } from './saveZipsToFolder';

export interface ExportEnvironments {
  download?: DownloadEnvironment;
  folder?: FolderEnvironment;
}

/**
 * Storage-backends R13: the save and folder environments the zip writers run in. In the desktop window the pickers are the native dialogs Rust opens;
 * with none (the browser, or a test) the result is empty and the writers use the browser's own pickers.
 */
export function exportEnvironments(pickers: DesktopPickers | undefined): ExportEnvironments {
  if (pickers === undefined) return {};
  return {
    download: { showSaveFilePicker: pickers.showSaveFilePicker, saveBlob: saveBlobAsFile },
    folder: { showDirectoryPicker: pickers.showDirectoryPicker, saveBlob: saveBlobAsFile },
  };
}
