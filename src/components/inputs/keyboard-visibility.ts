export type VerticalBounds = { top: number; bottom: number };

/** Return only the movement needed to reveal a field; visible fields never move. */
export function keyboardRevealDelta(field: VerticalBounds, viewport: VerticalBounds, gap = 12): number {
  const available = viewport.bottom - viewport.top;
  if (available <= 0 || field.bottom <= field.top) return 0;
  if (field.top >= viewport.top && field.bottom <= viewport.bottom) return 0;
  // An oversized editor cannot fit: retain its visible top and let native text
  // scrolling handle the caret, rather than alternating between its two edges.
  if (field.bottom - field.top > available) {
    if (field.top >= viewport.top && field.top < viewport.bottom - gap) return 0;
    return field.top - viewport.top;
  }
  const margin = Math.min(gap, Math.max(0, (available - (field.bottom - field.top)) / 2));
  if (field.bottom > viewport.bottom) return field.bottom - viewport.bottom + margin;
  return field.top - viewport.top - margin;
}
