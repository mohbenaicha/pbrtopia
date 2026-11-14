import { act, fireEvent } from '@testing-library/react';

/**
 * App tooltips R2: the words of a control's tooltip, read through the description link (`aria-describedby`) of the control or of the nearest wrapper that holds it
 * (the hover target of a disabled button); empty when there is none, as for a heading-only tooltip.
 */
export function describeTooltipOf(element: Element): string {
  const holder = element.closest('[aria-describedby]');
  const ids = (holder?.getAttribute('aria-describedby') ?? '').split(/\s+/).filter((id) => id !== '');
  return ids.map((id) => element.ownerDocument.getElementById(id)?.textContent ?? '').join(' ').trim();
}

/** App tooltips R3, R7: opens the tooltip of an enabled control by keyboard focus (no timers needed), reads its heading and text as `heading. text`, and closes it again. */
export function openTooltipTextOf(element: Element): string {
  act(() => void document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true })));
  fireEvent.focus(element);
  const panel = document.querySelector('[role="tooltip"]');
  const words = [...(panel?.querySelectorAll('p') ?? [])].map((paragraph) => paragraph.textContent ?? '').join('. ');
  fireEvent.blur(element);
  return words;
}
