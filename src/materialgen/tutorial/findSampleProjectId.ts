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
