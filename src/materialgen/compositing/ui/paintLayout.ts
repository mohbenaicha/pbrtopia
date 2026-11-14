/** Compositing R47: the widths of the paint panel's layout, in one place. `paintPanel.css` repeats the two hide widths in its container queries (CSS cannot read this). */
export const PANEL_MIN_PX = 300; // label 88 + slider 80 + readout 48 + dice 28 + reset 28 + gaps
export const READOUT_HIDE_PX = 340; // below this panel width the numeric readouts are hidden
export const RANGE_READOUT_HIDE_PX = 420; // below this the two-number readout of an active range is hidden too: it is wider, and would squeeze the track

/** The left panel's floor while the material app is open (shell `usePanelWidths`); a constant, so its identity is stable. */
export const LEFT_PANEL_FLOOR = { left: PANEL_MIN_PX } as const;
