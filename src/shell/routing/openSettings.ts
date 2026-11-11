interface OpenSettingsSteps {
  isSetOpen: boolean;
  leaveSet(): Promise<boolean>; // Exit: saves, then true once left; false when the save failed
  isStillOpen(): boolean;
  show(): void; // goes to the Settings address
}

/**
 * Settings R1: an open set is left through Exit first. If its save fails the person stays on the project (the host shows the message with Retry).
 * Unlike Open project this does not close the project: it stays the remembered one and no thumbnail is taken.
 */
export async function openSettings(steps: OpenSettingsSteps): Promise<void> {
  if (steps.isSetOpen && !(await steps.leaveSet())) return;
  if (!steps.isStillOpen()) return; // the view was left during the save
  steps.show();
}
