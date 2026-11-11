/** How much space the browser says is free, or null when it will not say (maps R67, app R36). */
export async function estimateFreeBytes(): Promise<number | null> {
  try {
    const { quota, usage } = await navigator.storage.estimate();
    return quota === undefined || usage === undefined ? null : quota - usage;
  } catch {
    return null;
  }
}
