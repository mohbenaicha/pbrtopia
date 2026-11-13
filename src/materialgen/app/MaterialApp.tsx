import { useMemo, useState } from 'react';
import { ImportProjectButton, ImportProjectStatus, ProjectListView } from '@shared/projects';
import { RouteSwitch, exportEnvironments, useDesktopPickers } from '@shared/shell';
import { Button, Icon } from '@shared/ui-kit';
import type { MaterialProjectStore } from '@mat/storage';
import { useSampleProjects } from './samples/useSampleProjects';
import { createMaterialListExporter } from './list/materialListExporter';
import { NewMaterialProjectButton } from './list/NewMaterialProjectButton';
import { useMaterialImport } from './project/materialZipTransfer';
import { MaterialProjectView } from './project/MaterialProjectView';
import { projectHash, settingsHash } from './routes/router';
import type { StartupDecision } from './routes/startup';
import { useAddressWatcher } from './routes/useAddressWatcher';
import { MaterialSettingsView } from './settings/MaterialSettingsView';

const NOTICE_TEXT = { 'project-not-found': 'That project no longer exists.', 'address-unknown': 'That address does not lead anywhere, so here are your projects.' } as const;

/** Materialgen app R23a, R23b: what deleting a project loses, in this app's words. */
export const DELETE_EFFECT = 'Its maps and thumbnail are removed from this browser. This cannot be undone.';

interface MaterialAppProps {
  store: MaterialProjectStore;
  initial: StartupDecision;
}

/** The material app's views by address (materialgen app R9): the project list, an open project, and the settings. */
export function MaterialApp({ store, initial }: MaterialAppProps): React.JSX.Element {
  const { route, notice, dismissNotice } = useAddressWatcher(store, initial);
  const [listVersion, setListVersion] = useState(0); // bumped when an import ends, so the list is read again
  const projectImport = useMaterialImport(store, () => setListVersion((version) => version + 1));
  const samples = useSampleProjects(store); // the bundled samples, imported once at the first start (default-projects R11)
  const pickers = useDesktopPickers();
  const exporter = useMemo(() => createMaterialListExporter(store, exportEnvironments(pickers)), [store, pickers]);

  return (
    <RouteSwitch
      route={route}
      views={{
        list: !samples.checked ? null : (
          <ProjectListView
            key={listVersion}
            store={store}
            placeholderCount={samples.remaining}
            refreshToken={samples.refresh}
            deleteEffect={DELETE_EFFECT}
            onOpen={(id) => {
              window.location.hash = projectHash(id);
            }}
            createActions={(large) => (
              <>
                <NewMaterialProjectButton store={store} large={large} />
                <ImportProjectButton state={projectImport} showStatus={false} />
              </>
            )}
            exporter={exporter}
            status={
              <>
                <ImportProjectStatus state={projectImport} />
                {samples.failures.map((failure) => (
                  <p key={failure} role="alert">{`Sample project not added: ${failure}`}</p>
                ))}
              </>
            }
            headerActions={
              <Button
                icon={<Icon name="gear" size={26} />}
                title="Settings"
                onClick={() => {
                  window.location.hash = settingsHash('keys');
                }}
              >
                Settings
              </Button>
            }
            notice={notice === null ? null : NOTICE_TEXT[notice]}
            onDismissNotice={dismissNotice}
          />
        ),
        project: (id) => <MaterialProjectView key={id} store={store} projectId={id} />,
        settings: (section) => <MaterialSettingsView store={store} section={section} projectImport={projectImport} />,
      }}
    />
  );
}
