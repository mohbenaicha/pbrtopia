import { useEffect, useRef, useState } from 'react';
import { Button, Icon } from '@shared/ui-kit';
import type { MaterialProjectStore } from '@mat/storage';
import { projectHash } from '../routes/router';
import { NewMaterialProjectDialog } from './NewMaterialProjectDialog';

interface NewMaterialProjectButtonProps {
  store: Pick<MaterialProjectStore, 'createProject' | 'requestPersistence'>;
  large?: boolean; // the empty list's one big action
}

/** Materialgen app R24, R24a: New project asks for the name and size, creates an empty project and opens it. A failure is shown in the dialog and nothing is opened. */
export function NewMaterialProjectButton({ store, large = false }: NewMaterialProjectButtonProps): React.JSX.Element {
  const mounted = useRef(true);
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  return (
    <>
      <Button variant="primary" size={large ? 'large' : 'default'} tutorial="projects-new" icon={<Icon name="plus" size={26} />} title="New project" onClick={() => setOpen(true)}>
        New project
      </Button>
      {open && (
        <NewMaterialProjectDialog
          busy={busy}
          error={error}
          onCancel={() => {
            setOpen(false);
            setError(null);
          }}
          onCreate={(name, size) => {
            setBusy(true);
            setError(null);
            void store.createProject({ name, size }).then((result) => {
              if (result.ok) void store.requestPersistence(); // asks the browser to keep this origin's storage; the answer changes nothing here
              if (!mounted.current) return; // the user went elsewhere meanwhile: the project is stored, but it must not take over the address
              setBusy(false);
              if (result.ok) {
                setOpen(false);
                window.location.hash = projectHash(result.value.id);
              } else setError(result.error.message);
            });
          }}
        />
      )}
    </>
  );
}
