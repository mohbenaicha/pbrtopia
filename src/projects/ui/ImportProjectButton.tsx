import { useRef } from 'react';
import { Button, Icon } from '../../ui-kit';

/** What the Import control shows and can do; the app's import hook supplies it (projects R12). */
export interface ProjectImportState {
  importing: boolean;
  progress: number | null; // 0-1 by the zip's files while importing, else null
  message: string | null; // the last import's result line
  error: string | null;
  start(file: File): Promise<void>;
}

/** The progress, result and error lines of an import (projects R12); the list shows them under its header, the Storage page under its button. */
export function ImportProjectStatus({ state }: { state: ProjectImportState }): React.JSX.Element {
  return (
    <>
      {state.importing && state.progress !== null && <p role="status">Importing… {Math.round(state.progress * 100)}%</p>}
      {!state.importing && state.message !== null && <p role="status">{state.message}</p>}
      {state.error !== null && <p role="alert">{state.error}</p>}
    </>
  );
}

// Projects R12: picks a project zip and starts the import; busy while it runs. With `showStatus` (the default) the result lines follow the button.
export function ImportProjectButton({ state, showStatus = true }: { state: ProjectImportState; showStatus?: boolean }): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  const button = (
    <>
      <Button loading={state.importing} tutorial="projects-import" icon={<Icon name="upload" size={26} />} title="Import project" onClick={() => input.current?.click()}>
        Import project
      </Button>
      <input
        ref={input}
        type="file"
        hidden
        accept=".zip,application/zip"
        data-testid="project-zip-input"
        onChange={(event) => {
          const file = event.target.files?.[0];
          event.target.value = '';
          if (file) void state.start(file);
        }}
      />
    </>
  );
  if (!showStatus) return button;
  return (
    <div>
      {button}
      <ImportProjectStatus state={state} />
    </div>
  );
}
