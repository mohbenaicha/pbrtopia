import { useRef } from 'react';
import { Button } from '../../ui-kit';

/** What the Import control shows and can do; the app's import hook supplies it (projects R12). */
export interface ProjectImportState {
  importing: boolean;
  progress: number | null; // 0-1 by the zip's files while importing, else null
  message: string | null; // the last import's result line
  error: string | null;
  start(file: File): Promise<void>;
}

// Projects R12: picks a project zip and starts the import; busy with a percentage while it runs, then the result line or the typed error.
export function ImportProjectButton({ state }: { state: ProjectImportState }): React.JSX.Element {
  const input = useRef<HTMLInputElement>(null);
  return (
    <div>
      <Button loading={state.importing} onClick={() => input.current?.click()}>
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
      {state.importing && state.progress !== null && <p role="status">Importing… {Math.round(state.progress * 100)}%</p>}
      {!state.importing && state.message !== null && <p role="status">{state.message}</p>}
      {state.error !== null && <p role="alert">{state.error}</p>}
    </div>
  );
}
