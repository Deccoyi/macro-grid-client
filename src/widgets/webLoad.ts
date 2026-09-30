/** A web widget that could be live right now, in the order the deck prefers to load them. */
export interface WebCandidate {
  widgetId: string;
  /** The `web:<host>` id of the address it shows. */
  siteId: string;
}

/**
 * Which web widgets load and which wait with a "Tap to load" placeholder. The candidates come in the order they should get a slot (kept-loaded widgets
 * of other pages first, then the shown page in page order). A widget the person tapped always loads, and it still uses up a slot, so the limit is a
 * recommendation and not a wall.
 */
export function planWebLoad(candidates: readonly WebCandidate[], limit: number, tapped: ReadonlySet<string>): { live: WebCandidate[]; waiting: Set<string> } {
  const live: WebCandidate[] = [];
  const waiting = new Set<string>();
  for (const c of candidates) {
    if (tapped.has(c.widgetId) || live.length < limit) live.push(c);
    else waiting.add(c.widgetId);
  }
  return { live, waiting };
}
