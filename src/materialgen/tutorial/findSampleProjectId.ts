interface ProjectLister {
  listProjects(): Promise<{ ok: true; value: Array<{ id: string; name: string }> } | { ok: false }>;
}

const plain = (name: string): string => name.toLowerCase().replace(/[-_\s]+/g, ' ').trim();

/**
 * The id of the project the tour's project steps run in (tutorial R4): the first bundled sample, in the bundle's order, that is still in the list under its name.
 * A user's own project is never a fallback; with no sample left the steps show without their view (R8).
 */
export async function findSampleProjectId(store: ProjectLister, sampleNames: readonly string[]): Promise<string | null> {
  const listed = await store.listProjects();
  if (!listed.ok) return null;
  for (const sample of sampleNames) {
    const match = listed.value.find((project) => plain(project.name) === plain(sample));
    if (match !== undefined) return match.id;
  }
  return null;
}

const SAMPLE_POLL_MS = 100;

/** The sample's id, waiting for the background import while it still runs (tutorial R21); null once nothing is pending and no sample is there. */
export async function findSampleProjectWhenImported(store: ProjectLister, isPending: () => boolean, sampleNames: readonly string[], pollMs: number = SAMPLE_POLL_MS): Promise<string | null> {
  for (;;) {
    const id = await findSampleProjectId(store, sampleNames);
    if (id !== null || !isPending()) return id;
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
}
